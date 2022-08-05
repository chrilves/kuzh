package chrilves.kuzh.back.models

import cats.*
import cats.effect.*
import cats.implicits.*
import cats.syntax.eq.*
import io.circe.*
import io.circe.syntax.*

import java.time.Instant
import scala.collection.*

import java.util.UUID
import cats.effect.kernel.Sync.Type.Blocking
import cats.evidence.As
import cats.effect.std.Semaphore
import scala.annotation.tailrec

import chrilves.kuzh.back.*
import chrilves.kuzh.back.models.Assembly.Destination
import chrilves.kuzh.back.models.assembly.*
import chrilves.kuzh.back.models.State.*
import chrilves.kuzh.back.models.Status.*
import chrilves.kuzh.back.models.Phase.*
import chrilves.kuzh.back.models.Member.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.services.IdentityProofStore

final class Assembly[F[_]] private (
    val info: assembly.Info,
    private val identityProofStore: IdentityProofStore[F],
    private val close: F[Unit],
    private val mutex: Semaphore[F],
    private val refChannels: Ref[F, immutable.Map[Member.Fingerprint, Connection.Handler[F]]],
    private val refAbsent: Ref[F, immutable.Map[Fingerprint, Instant]],
    private val refQuestions: Ref[F, List[String]],
    private val refStatus: Ref[F, Status[Nothing]]
):
  private final val minParticipants = 3;
  private final val absentSize      = 10;

  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
    identityProofStore.fetch(fp)

  /////////////////////////////////////////////////
  //  State Info

  private def state(member: Fingerprint)(using Sync[F]): F[State[Any]] =
    for
      present   <- refChannels.get.map(_.keySet)
      absent    <- refAbsent.get
      questions <- refQuestions.get
      status    <- refStatus.get
    yield State(
      questions,
      present = present,
      absent = absent,
      status match
        case Harvesting(h, _) if !h.participants.contains(member) =>
          Hidden
        case _ =>
          status
    )

  private def participants(using Sync[F]): F[Set[Fingerprint]] =
    refStatus.get.map(_.participants)

  private def present(using Sync[F]): F[Set[Fingerprint]] =
    refChannels.get.map(_.keySet)

  private inline def setAbsent(member: Fingerprint)(using Sync[F]): F[Instant] =
    for
      i <- Sync[F].realTimeInstant
      q <- refAbsent.modify { x =>
        val absent = x.toList.sortBy(-_._2.toEpochMilli())
        val keep   = absent.take(absentSize).toMap + (member -> i)
        val remove = absent.drop(absentSize).map(_._1)
        (keep, (i, remove))
      }
      _ <- q._2.traverse(identityProofStore.delete)
    yield q._1

  private inline def logState(name: String)(using Sync[F]): F[Unit] =

    def log(s: String): F[Unit] =
      Sync[F].delay(println(s"${Console.YELLOW}${s}${Console.RESET}"))

    for
      ps <- refChannels.get
      _  <- log(s"=== [${name}] Presents ===")
      _  <- ps.keys.toList.traverse(p => log(s"  - ${p}"))
      qs <- refQuestions.get
      _  <- log(s"=== [${name}] Questions ===")
      _  <- qs.traverse(q => log(s"  - ${q}"))
      _  <- log(s"=== [${name}] Status ===")
      st <- refStatus.get
      _  <- log(st.asJson.spaces4)
      _  <- log(s"=== [${name}] END ===")
    yield ()

  /////////////////////////////////////////////////
  //  Messages

  private def sendMessage(to: Destination, event: Assembly.Event)(using Sync[F]): F[Unit] =
    refChannels.get.flatMap { channels =>
      to match
        case Destination.All =>
          channels.toSeq.traverse(kv => kv._2.send(event).attempt).void
        case Destination.Selected(members) =>
          members.toSeq.traverse { member =>
            channels.get(member) match
              case Some(handler) =>
                handler.send(event).attempt.void
              case _ =>
                Sync[F].pure(())
          }.void
        case Destination.Filtered(f) =>
          channels.filter(kv => f(kv._1)).toSeq.traverse(kv => kv._2.send(event).attempt).void
    }

  /////////////////////////////////////////////////
  //  Status Manipulation

  private def forcedWaiting(blocking: Option[Fingerprint])(using
      Sync[F]
  ): F[Status.Waiting] =
    refStatus.get.flatMap {
      case w @ Waiting(i, q, r) =>
        blocking match
          case Some(m) =>
            val w2: Status.Waiting = Waiting(i, q, r + (m -> Member.Readiness.Blocking))
            refStatus.set(w2) *> Sync[F].pure(w2)
          case None =>
            Sync[F].pure(w)
      case Harvesting(h, _) =>
        present.flatMap { members =>
          val w2: Status.Waiting =
            Waiting(
              h.id,
              h.question,
              members.toList.map { m =>
                m -> (
                  if blocking.contains(m)
                  then Member.Readiness.Blocking
                  else if h.participants.contains(m)
                  then Member.Readiness.Ready
                  else Member.Readiness.Answering
                )
              }.toMap
            )
          refStatus.set(w2) *> Sync[F].pure(w2)
        }
    }

  private def reduceStatus(using Sync[F]): F[Unit] =
    refStatus.get.flatMap {
      case Waiting(i, q, r) =>
        Sync[F].whenA(r.size >= minParticipants && r.forall(_._2 === Member.Readiness.Ready)) {
          refStatus.set {
            val participants = r.keys.toSet
            val harvest      = Harvest(i, q, participants)
            Harvesting(harvest, Proposed(participants))
          }
        }
      case Harvesting(h, Proposed(r)) =>
        if h.participants.size < minParticipants
        then forcedWaiting(None).void
        else if r.isEmpty
        then
          val remaining = h.participants.toList
          for
            _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Hashes(remaining))))
            _ <- sendMessage(
              Destination.Selected(Set(remaining.head)),
              Assembly.Event.Protocol(HarvestProtocol.Event.Hash(Nil, remaining.tail))
            )
          yield ()
        else Sync[F].pure(())
      case Harvesting(h, Started(_)) =>
        Sync[F].pure(())
    }

  private def reduceAndSync(participants: Set[Member.Fingerprint])(using
      Sync[F]
  ): F[Unit] =
    for
      before <- refStatus.get
      _      <- reduceStatus
      after  <- refStatus.get
      _ <-
        if participants.nonEmpty && after.isWaiting
        then
          sendMessage(
            Destination.Filtered((x) => !participants.contains(x)),
            Assembly.Event.Status(after)
          )
        else Sync[F].pure(())
    yield ()

  def registerMember(id: IdentityProof)(using Sync[F]): F[Unit] =
    if id.isValid
    then
      mutex.permit.surround {
        identityProofStore.fetch(id.fingerprint).flatMap {
          case Some(id2) =>
            if id === id2
            then Sync[F].pure(())
            else
              Sync[F].raiseError(
                new Exception("Trying to register another identity proof with same fingerprint")
              )
          case None =>
            identityProofStore.store(id) *> setAbsent(id.fingerprint).void
        } *> logState("registerMember")
      }
    else Sync[F].raiseError(new Exception("Trying to register an invalid identity proof"))

  private def unsafeRemoveMember(member: Member.Fingerprint, error: Option[String])(using
      Sync[F]
  ): F[Unit] =
    refChannels.modify(m => (m - member, m.get(member))).flatMap {
      case Some(handler) =>
        for
          _ <- error.traverse(reason => handler.send(Assembly.Event.Error(reason, true)).attempt)
          _ <- handler.close().attempt
          i <- setAbsent(member)
          _ <- sendMessage(
            Destination.All,
            Assembly.Event.Public(State.Event.MemberPresence(member, Member.Presence.Absent(i)))
          )
          _ <- refStatus.get.flatMap {
            case Waiting(i, q, r) =>
              refStatus.set(Waiting(i, q, r - member)) *> reduceStatus
            case Harvesting(h, phase) if h.participants.contains(member) =>
              val newParticipants = h.participants - member
              val newHarvest      = h.copy(participants = newParticipants)

              phase match
                case Proposed(r) =>
                  refStatus.set(Harvesting(newHarvest, Proposed(r - member))) *> reduceAndSync(
                    newParticipants
                  )
                case Started(_) =>
                  for
                    _ <- refStatus.set(Harvesting(newHarvest, Started(HarvestProtocol.Hashes(Nil))))
                    _ <- forcedWaiting(None)
                    _ <- reduceAndSync(newParticipants)
                  yield ()
            case _ =>
              Sync[F].pure(())
          }
        yield ()
      case None =>
        Sync[F].pure(())
    }

  def removeMember(member: Member.Fingerprint, error: Option[String])(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      for
        _        <- unsafeRemoveMember(member: Member.Fingerprint, error)
        _        <- logState("removeMember")
        channels <- refChannels.get
        _        <- Sync[F].whenA(channels.isEmpty)(close)
      yield ()
    }

  def memberChannel(
      member: Member.Fingerprint,
      handler: Connection.Handler[F]
  )(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      for
        _ <- unsafeRemoveMember(member, Some("Double Connection!"))
        _ <- sendMessage(
          Destination.Filtered(_ =!= member),
          Assembly.Event.Public(State.Event.MemberPresence(member, Member.Presence.Present))
        )
        _ <- refChannels.modify(m => (m + (member -> handler), ()))
        _ <- refAbsent.modify(m => (m - member, ()))
        _ <- refStatus.modify {
          case Waiting(i, q, r) =>
            (Waiting(i, q, r + (member -> Member.Readiness.Answering)), ())
          case st =>
            (st, ())
        }
        st <- state(member)
        _  <- sendMessage(Destination.Selected(Set(member)), Assembly.Event.State(st))
        _  <- logState("memberMessage")
      yield ()
    }

  def memberMessage(member: Member.Fingerprint, message: Member.Event)(using Sync[F]): F[Unit] =
    import Member.Event.*
    import chrilves.kuzh.back.lib.isSorted
    mutex.permit.surround {
      message match
        case Member.Event.Blocking(b) =>
          memberBlocking(member, b)
        case AcceptHarvest =>
          refStatus.get.flatMap {
            case Harvesting(h, Proposed(r))
                if h.participants.contains(member) && r.contains(member) =>
              for
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  Assembly.Event.Harvesting(Harvest.Event.Accepted(member))
                )
                _ <- refStatus.set(Harvesting(h, Proposed(r - member)))
                _ <- reduceStatus
              yield ()
            case _ =>
              Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
          }
        case HashNext(msgs) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Hashes(hd :: tl)))
                if member === hd && tl.nonEmpty && msgs.isSorted =>
              for
                _ <- sendMessage(
                  Destination.Selected(Set(tl.head)),
                  Assembly.Event.Protocol(
                    HarvestProtocol.Event.Hash(
                      msgs,
                      tl.tail
                    )
                  )
                )
                _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Hashes(tl))))
              yield ()
            case _ =>
              Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
          }
        case Hashes(hs) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Hashes(hd :: Nil))) if hd === member =>
              for
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  Assembly.Event.Protocol(HarvestProtocol.Event.Validate(hs))
                )
                _ <- refStatus.set(
                  Harvesting(h, Started(HarvestProtocol.Verification(hs, immutable.Map.empty)))
                )
              yield ()
            case _ =>
              Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
          }
        case Member.Event.Invalid =>
          Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
        case Member.Event.Vallid(sig) =>
          def verifOk(
              ipOpt: Option[IdentityProof],
              h: Harvest,
              hs: List[Base64UrlEncoded]
          ): Boolean =
            ipOpt match {
              case Some(ip) =>
                withVerify[Boolean](ip.verify.toRSAPublicKey) { f =>
                  given Signable[HarvestProtocol.Proof] =
                    Signable.fromEncoder[HarvestProtocol.Proof]
                  f[HarvestProtocol.Proof](
                    Signed(
                      HarvestProtocol.Proof(h, hs),
                      sig
                    )
                  )
                }
              case None =>
                false
            }
          this.identityProofStore.fetch(member).flatMap { ipOpt =>
            refStatus.get.flatMap {
              case Harvesting(h, Started(HarvestProtocol.Verification(hs, sigs)))
                  if h.participants.contains(member) && !sigs
                    .contains(member) && verifOk(ipOpt, h, hs) =>
                val newSigs = sigs + (member -> sig);
                if sigs.size === h.participants.size
                then
                  val remaining = h.participants.toList
                  for
                    _ <- sendMessage(
                      Destination.Selected(h.participants),
                      Assembly.Event.Protocol(HarvestProtocol.Event.Validity(newSigs))
                    )
                    _ <- sendMessage(
                      Destination.Selected(Set(remaining.head)),
                      Assembly.Event.Protocol(HarvestProtocol.Event.Real(Nil, remaining.tail))
                    )
                    _ <- refStatus.set(
                      Harvesting(h, Started(HarvestProtocol.Reals(hs, sigs, remaining)))
                    )
                  yield ()
                else
                  refStatus.set(Harvesting(h, Started(HarvestProtocol.Verification(hs, newSigs))))
              case _ =>
                Sync[F]
                  .pure(println(s"Ingoring from member ${member} message ${message.toString}."))
            }
          }
        case RealNext(msgs) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Reals(hs, s, hd :: tl))) =>
              for
                _ <- sendMessage(
                  Destination.Selected(Set(hd)),
                  Assembly.Event.Protocol(
                    HarvestProtocol.Event.Real(
                      msgs,
                      tl
                    )
                  )
                )
                _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Reals(hs, s, tl))))
              yield ()
            case _ =>
              Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
          }
        case Member.Event.Reals(r) =>
          Sync[F].pure(println(s"Ingoring from member ${member} message ${message.toString}."))
    } *> logState("memberMessage")

  private def memberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)(using
      Sync[F]
  ): F[Unit] =
    refStatus.get.flatMap {
      case Waiting(i, q, r) if r.get(member) =!= Some(blocking) =>
        for
          _ <- sendMessage(
            Destination.All,
            Assembly.Event.Public(State.Event.MemberBlocking(member, blocking))
          )
          _ <- refStatus.set(Waiting(i, q, r + (member -> blocking)))
          _ <- reduceStatus
        yield ()
      case p @ Harvesting(h, Proposed(r))
          if (blocking: Member.Readiness) === Member.Readiness.Blocking && h.participants.contains(
            member
          ) && r.contains(member) =>
        for
          _ <- sendMessage(
            Destination.Selected(h.participants),
            Assembly.Event.Public(State.Event.MemberBlocking(member, blocking))
          )
          _ <- forcedWaiting(Some(member))
          _ <- reduceAndSync(h.participants)
        yield ()
      case _ =>
        Sync[F].pure(())
    }

object Assembly:
  def make[F[_]: Async](
      identityProofStore: IdentityProofStore[F],
      info: assembly.Info,
      close: F[Unit]
  ): F[Assembly[F]] =
    for
      mutex       <- Semaphore[F](1)
      refChannels <- Ref.of(immutable.Map.empty[Fingerprint, Connection.Handler[F]])
      refAbsent   <- Ref.of(immutable.Map.empty[Fingerprint, Instant])
      refQuestons <- Ref.of(List.empty[String])
      status      <- Status.init
      refStatus   <- Ref.of(status)
    yield new Assembly(
      info,
      identityProofStore,
      close,
      mutex,
      refChannels,
      refAbsent,
      refQuestons,
      refStatus
    )

  private enum Destination:
    case All
    case Selected(members: Set[Member.Fingerprint])
    case Filtered(f: Fingerprint => Boolean)

  enum Event:
    case State(public: models.State[Any])
    case Status(status: models.Status[Any])
    case Public(public: models.State.Event)
    case Harvesting(harvesting: Harvest.Event)
    case Protocol(protocol: HarvestProtocol.Event)
    case Error(error: String, fatal: Boolean)

  object Event:
    given assemblyEventEncoder: Encoder[Event] with
      final def apply(i: Event): Json =
        i match
          case State(p) =>
            Json.obj(
              "tag"   -> Json.fromString("state"),
              "state" -> p.asJson
            )
          case Status(status) =>
            Json.obj(
              "tag"    -> Json.fromString("status"),
              "status" -> status.asJson
            )
          case Public(e) =>
            Json.obj(
              "tag"    -> Json.fromString("public"),
              "public" -> e.asJson
            )
          case Harvesting(e) =>
            Json.obj(
              "tag"        -> Json.fromString("harvesting"),
              "harvesting" -> e.asJson
            )
          case Protocol(e) =>
            Json.obj(
              "tag"      -> Json.fromString("protocol"),
              "protocol" -> e.asJson
            )
          case Error(error, fatal) =>
            Json.obj(
              "tag"   -> Json.fromString("error"),
              "error" -> Json.fromString(error),
              "fatal" -> Json.fromBoolean(fatal)
            )
