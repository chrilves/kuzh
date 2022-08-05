package chrilves.kuzh.back.models

import cats.*
import cats.data.{Kleisli, ReaderT}
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
    private val stateMutex: Semaphore[F],
    private val refChannels: Ref[F, immutable.Map[Member.Fingerprint, Connection.Handler[F]]],
    private val refAbsent: Ref[F, immutable.Map[Fingerprint, Instant]],
    private val refQuestions: Ref[F, List[String]],
    private val refStatus: Ref[F, Status[Nothing]]
)(using F: Async[F]):
  private final val minParticipants = 3;
  private final val absentSize      = 10;

  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
    identityProofStore.fetch(fp)

  /////////////////////////////////////////////////
  //  Mutex Handling

  type Mutexed[A] = ReaderT[F, Boolean, A]

  private inline def withMutex[A](f: => F[A]): Mutexed[A] =
    Kleisli((alreadySecured) =>
      if alreadySecured then f
      else
        for
          _ <- Async[F].delay(println("############### ACQUIRE MUTEX ####################"))
          a <- stateMutex.permit.surround(f)
          _ <- Async[F].delay(println("~~~~~~~~~~~~~~~ RLEASE  MUTEX ~~~~~~~~~~~~~~~~~~~~"))
        yield a
    )

  private inline def withMutexK[A](f: => Mutexed[A]): Mutexed[A] =
    Kleisli((alreadySecured) =>
      if alreadySecured
      then f(true)
      else
        for
          _ <- Async[F].delay(println("/////////////// ACQUIRE MUTEX ////////////////////"))
          a <- stateMutex.permit.surround(f(true))
          _ <- Async[F].delay(println("--------------- RLEASE  MUTEX --------------------"))
        yield a
    )

  private inline def liftM[A](f: => F[A]): Mutexed[A] =
    Kleisli.liftF(f)

  private inline def runWithMutex[A](f: Mutexed[A]): F[A] =
    for
      _ <- Async[F].delay(println("=============== ACQUIRE RUN MUTEX ================"))
      a <- f(false) // stateMutex.permit.surround(f(true))
      _ <- Async[F].delay(println("_______________ RLEASE  RUN MUTEX ________________"))
    yield a

  private inline def getStatus: Mutexed[Status[Nothing]]          = liftM(refStatus.get)
  private inline def setStatus(s: Status[Nothing]): Mutexed[Unit] = liftM(refStatus.set(s))

  private inline def getConnections: Mutexed[immutable.Map[Fingerprint, Connection.Handler[F]]] =
    liftM(refChannels.get)
  private inline def setConnections(
      c: immutable.Map[Fingerprint, Connection.Handler[F]]
  ): Mutexed[Unit] = liftM(refChannels.set(c))

  private inline def identityProofM(fp: Member.Fingerprint): Mutexed[Option[IdentityProof]] = liftM(
    identityProofStore.fetch(fp)
  )
  private inline def storeIdentityProof(ip: IdentityProof): Mutexed[Unit] = liftM(
    identityProofStore.store(ip)
  )

  /////////////////////////////////////////////////
  //  State Info

  private def state(member: Fingerprint, hidding: Boolean = true): Mutexed[State[Any]] =
    withMutex {
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
          case Harvesting(h, _) if !h.participants.contains(member) && hidding =>
            Hidden
          case _ =>
            status
      )
    }

  private def participants: Mutexed[Set[Fingerprint]] =
    liftM(refStatus.get.map(_.participants))

  private def present: Mutexed[Set[Fingerprint]] =
    getConnections.map(_.keySet)

  private inline def getAbsent: Mutexed[immutable.Map[Fingerprint, Instant]] = liftM(refAbsent.get)

  private inline def setAbsent(member: Fingerprint): Mutexed[Instant] =
    liftM {
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
    }

  private inline def logState(name: String): Mutexed[Unit] =
    withMutex {
      state(Fingerprint.fromString(""), false)(true).flatMap { (st: State[Any]) =>
        Async[F].delay {
          println(
            s"${Console.CYAN}[${Instant
                .now()}] ${name}: state of assembly ${info.name}:${info.id} ${st.asJson.spaces4} ${Console.RESET}"
          )
        }
      }
    }

  /////////////////////////////////////////////////
  //  Messages

  private def sendMessage(to: Destination, event: Assembly.Event): Mutexed[Unit] =
    liftM {
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
    }

  /////////////////////////////////////////////////
  //  Status Manipulation

  private def forcedWaiting(blocking: Option[Fingerprint]): Mutexed[Status.Waiting] =
    withMutex {
      refStatus.get.flatMap {
        case w @ Waiting(i, q, r) =>
          blocking match
            case Some(m) =>
              val w2: Status.Waiting = Waiting(i, q, r + (m -> Member.Readiness.Blocking))
              refStatus.set(w2) *> Sync[F].pure(w2)
            case None =>
              Sync[F].pure(w)
        case Harvesting(h, _) =>
          refChannels.get.flatMap { members =>
            val w2: Status.Waiting =
              Waiting(
                h.id,
                h.question,
                members.keys.toList.map { m =>
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
    }

  private def reduceStatus: Mutexed[Unit] =
    withMutexK {
      getStatus.flatMap {
        case Waiting(i, q, r) =>
          Async[Mutexed].whenA(
            r.size >= minParticipants && r.forall(_._2 === Member.Readiness.Ready)
          ) {
            setStatus {
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
              _ <- setStatus(Harvesting(h, Started(HarvestProtocol.Hashes(remaining))))
              _ <- sendMessage(
                Destination.Selected(Set(remaining.head)),
                Assembly.Event.Protocol(HarvestProtocol.Event.Hash(Nil, remaining.tail))
              )
            yield ()
          else Async[Mutexed].pure(())
        case Harvesting(h, Started(_)) =>
          Async[Mutexed].pure(())
      }
    }

  private def reduceAndSync(participants: Set[Member.Fingerprint]): Mutexed[Unit] =
    withMutexK {
      for
        before <- getStatus
        _      <- reduceStatus
        after  <- getStatus
        _ <-
          if participants.nonEmpty && after.isWaiting
          then
            sendMessage(
              Destination.Filtered((x) => !participants.contains(x)),
              Assembly.Event.Status(after)
            )
          else Async[Mutexed].pure(())
      yield ()
    }

  private def registerMember(id: IdentityProof): Mutexed[Unit] =
    if id.isValid
    then
      withMutexK {
        liftM(identityProofStore.fetch(id.fingerprint)).flatMap {
          case Some(id2) =>
            if id === id2
            then Async[Mutexed].pure(())
            else
              Async[Mutexed].raiseError(
                new Exception("Trying to register another identity proof with same fingerprint")
              )
          case None =>
            for
              _ <- liftM(identityProofStore.store(id))
              _ <- setAbsent(id.fingerprint)
            yield ()
        }
      }
    else Async[Mutexed].raiseError(new Exception("Trying to register an invalid identity proof"))

  private def unsafeRemoveMember(member: Member.Fingerprint, error: Option[String]): Mutexed[Unit] =
    withMutexK {
      liftM(refChannels.modify(m => (m - member, m.get(member)))).flatMap {
        case Some(handler) =>
          for
            _ <- logState("Before unsafe remove colose")
            _ <- logM(Console.YELLOW)(s"[${member}] unsafe remove close")
            _ <- liftM(handler.close().attempt.flatMap(s => log(Console.YELLOW)(s"ATTETMPS ${s}")))
            _ <- logM(Console.YELLOW)(s"[${member}] set absent")
            i <- setAbsent(member)
            _ <- sendMessage(
              Destination.All,
              Assembly.Event.Public(State.Event.MemberPresence(member, Member.Presence.Absent(i)))
            )
            _ <- logState("Before unsafe remove status change")
            _ <- logM(Console.YELLOW)(s"[${member}] unsafe remove status change")
            _ <- getStatus.flatMap {
              case Waiting(i, q, r) =>
                for
                  _ <- setStatus(Waiting(i, q, r - member))
                  _ <- reduceStatus
                yield ()
              case Harvesting(h, phase) if h.participants.contains(member) =>
                val newParticipants = h.participants - member
                val newHarvest      = h.copy(participants = newParticipants)

                phase match
                  case Proposed(r) =>
                    setStatus(Harvesting(newHarvest, Proposed(r - member))) *> reduceAndSync(
                      newParticipants
                    )
                  case Started(_) =>
                    for
                      _ <- setStatus(Harvesting(newHarvest, Started(HarvestProtocol.Hashes(Nil))))
                      _ <- forcedWaiting(None)
                      _ <- reduceAndSync(newParticipants)
                    yield ()
              case _ =>
                Async[Mutexed].pure(())
            }
          yield ()
        case None =>
          Async[Mutexed].pure(())
      }
    }

  def removeMember(member: Member.Fingerprint, error: Option[String]): F[Unit] =
    logState("Before before remove member")(true) *>
      runWithMutex {
        for
          _        <- logState("Before remove member")
          _        <- logM(Console.YELLOW)(s"RM [${member}] Removing")
          _        <- unsafeRemoveMember(member: Member.Fingerprint, error)
          _        <- logState("After unsafe removeMember")
          channels <- getConnections
          _        <- liftM(Async[F].whenA(channels.isEmpty)(close))
        yield ()
      }

  def logM(color: String)(s: String): Mutexed[Unit] =
    Async[Mutexed].delay(println(s"${color} $s${Console.RESET}"))

  def log(color: String)(s: String): F[Unit] =
    Async[F].delay(println(s"${color} $s${Console.RESET}"))

  def memberChannel(
      member: Member.Fingerprint,
      handler: Connection.Handler[F],
      establish: State[Any] => F[Unit],
      identityProof: Option[IdentityProof]
  ): F[Unit] =
    runWithMutex {
      for
        _ <- logState("Before memberChannel")
        _ <- logM(Console.YELLOW)(s"[${member}] Removing")
        _ <- unsafeRemoveMember(member, Some("Double Connection!"))
        _ <- logState("After remove")
        _ <- identityProof match
          case Some(ip) =>
            logM(Console.YELLOW)(s"[${member}] Register IP") *> registerMember(ip)
          case None =>
            logM(Console.YELLOW)(s"[${member}] NOT Register IP") *> Async[Mutexed].pure(())
        _ <- liftM {
          for
            _  <- log(Console.YELLOW)(s"[${member}] Checking IP Presence")
            ip <- identityProofStore.fetch(member)
            _ <- Async[F].whenA(ip.isEmpty)(
              log(Console.YELLOW)(s"[${member}] IP Absent") *>
                Async[F].raiseError(new Exception("Identity Proof not provided!"))
            )
            _ <- log(Console.YELLOW)(s"[${member}] Alter channels")
            _ <- refChannels.modify(m => (m + (member -> handler), ()))
            _ <- log(Console.YELLOW)(s"[${member}] Alter absent")
            _ <- refAbsent.modify(m => (m - member, ()))
            _ <- log(Console.YELLOW)(s"[${member}] Alter Status")
            _ <- refStatus.modify {
              case Waiting(i, q, r) =>
                (Waiting(i, q, r + (member -> Member.Readiness.Answering)), ())
              case st =>
                (st, ())
            }
          yield ()
        }
        _  <- logState("After state alter")
        _  <- logM(Console.YELLOW)(s"[${member}] Fetching state")
        st <- state(member)
        _  <- logM(Console.YELLOW)(s"[${member}] Establishing")
        _  <- liftM(establish(st))
        _  <- logM(Console.YELLOW)(s"[${member}] Informing others")
        _ <- sendMessage(
          Destination.Filtered(_ =!= member),
          Assembly.Event.Public(State.Event.MemberPresence(member, Member.Presence.Present))
        )
        _ <- logState("memberMessage")
      yield ()
    }

  def memberMessage(member: Member.Fingerprint, message: Member.Event)(using Sync[F]): F[Unit] =
    import Member.Event.*
    import chrilves.kuzh.back.lib.isSorted
    runWithMutex {
      message match
        case Member.Event.Blocking(b) =>
          memberBlocking(member, b)
        case AcceptHarvest =>
          getStatus.flatMap {
            case Harvesting(h, Proposed(r))
                if h.participants.contains(member) && r.contains(member) =>
              for
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  Assembly.Event.Harvesting(Harvest.Event.Accepted(member))
                )
                _ <- setStatus(Harvesting(h, Proposed(r - member)))
                _ <- reduceStatus
              yield ()
            case _ =>
              Async[Mutexed].pure(
                println(s"Ingoring from member ${member} message ${message.toString}.")
              )
          }
        case HashNext(msgs) =>
          getStatus.flatMap {
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
                _ <- setStatus(Harvesting(h, Started(HarvestProtocol.Hashes(tl))))
              yield ()
            case _ =>
              Async[Mutexed].pure(
                println(s"Ingoring from member ${member} message ${message.toString}.")
              )
          }
        case Hashes(hs) =>
          getStatus.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Hashes(hd :: Nil))) if hd === member =>
              for
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  Assembly.Event.Protocol(HarvestProtocol.Event.Validate(hs))
                )
                _ <- setStatus(
                  Harvesting(h, Started(HarvestProtocol.Verification(hs, immutable.Map.empty)))
                )
              yield ()
            case _ =>
              Async[Mutexed].pure(
                println(s"Ingoring from member ${member} message ${message.toString}.")
              )
          }
        case Member.Event.Invalid =>
          Async[Mutexed].pure(
            println(s"Ingoring from member ${member} message ${message.toString}.")
          )
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
          liftM(this.identityProofStore.fetch(member)).flatMap { ipOpt =>
            getStatus.flatMap {
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
                    _ <- setStatus(
                      Harvesting(h, Started(HarvestProtocol.Reals(hs, sigs, remaining)))
                    )
                  yield ()
                else setStatus(Harvesting(h, Started(HarvestProtocol.Verification(hs, newSigs))))
              case _ =>
                Async[Mutexed]
                  .pure(println(s"Ingoring from member ${member} message ${message.toString}."))
            }
          }
        case RealNext(msgs) =>
          getStatus.flatMap {
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
                _ <- setStatus(Harvesting(h, Started(HarvestProtocol.Reals(hs, s, tl))))
              yield ()
            case _ =>
              Async[Mutexed].pure(
                println(s"Ingoring from member ${member} message ${message.toString}.")
              )
          }
        case Member.Event.Reals(r) =>
          Async[Mutexed].pure(
            println(s"Ingoring from member ${member} message ${message.toString}.")
          )
    } *> logState("memberMessage")(true)

  private def memberBlocking(
      member: Member.Fingerprint,
      blocking: Member.Blockingness
  ): Mutexed[Unit] =
    withMutexK {
      getStatus.flatMap {
        case Waiting(i, q, r) if r.get(member) =!= Some(blocking) =>
          for
            _ <- sendMessage(
              Destination.All,
              Assembly.Event.Public(State.Event.MemberBlocking(member, blocking))
            )
            _ <- setStatus(Waiting(i, q, r + (member -> blocking)))
            _ <- reduceStatus
          yield ()
        case p @ Harvesting(h, Proposed(r))
            if (blocking: Member.Readiness) === Member.Readiness.Blocking && h.participants
              .contains(
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
          Async[Mutexed].pure(())
      }
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
    case Status(status: models.Status[Any])
    case Public(public: models.State.Event)
    case Harvesting(harvesting: Harvest.Event)
    case Protocol(protocol: HarvestProtocol.Event)
    case Error(error: String, fatal: Boolean)

  object Event:
    given assemblyEventEncoder: Encoder[Event] with
      final def apply(i: Event): Json =
        i match
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
