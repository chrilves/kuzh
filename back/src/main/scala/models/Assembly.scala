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
import cats.effect.std.Semaphore
import scala.annotation.tailrec

import chrilves.kuzh.back.*
import chrilves.kuzh.back.models.Assembly.Destination
import chrilves.kuzh.back.models.assembly.*
import chrilves.kuzh.back.models.State.*
import chrilves.kuzh.back.models.Status.*
import chrilves.kuzh.back.models.Phase.*
import chrilves.kuzh.back.models.Member.*
import chrilves.kuzh.back.models.Parameters.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.lib.isSorted
import chrilves.kuzh.back.services.IdentityProofStore

final class Assembly[F[_]] private (
    val info: assembly.Info,
    private val identityProofStore: IdentityProofStore[F],
    private val close: F[Unit],
    private val stateMutex: Semaphore[F],
    private val refChannels: Ref[F, immutable.Map[Member.Fingerprint, Connection.Handler[F]]],
    private val refAbsent: Ref[F, immutable.Map[Fingerprint, Instant]],
    private val refQuestions: Ref[F, List[Question]],
    private val refStatus: Ref[F, Status[Nothing]]
)(using F: Async[F]):

  def log(color: String)(s: String): F[Unit] =
    Async[F].delay(println(s"${color} $s${Console.RESET}"))

  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
    identityProofStore.fetch(fp)

  /////////////////////////////////////////////////
  //  Messages

  private def sendMessage(to: Destination, event: Assembly.Event): F[Unit] =
    def send(member: Fingerprint, h: Connection.Handler[F]): F[Unit] =
      h.send(event).handleErrorWith { e =>
        for
          _ <- Async[F].delay(e.printStackTrace())
          _ <- softRemoveMember(member)
        yield ()
      }

    refChannels.get.flatMap { channels =>
      to match
        case Destination.All =>
          channels.toSeq.traverse(kv => send(kv._1, kv._2)).void
        case Destination.Selected(members) =>
          members.toSeq.traverse { member =>
            channels.get(member) match
              case Some(handler) =>
                send(member, handler).void
              case _ =>
                Sync[F].pure(())
          }.void
        case Destination.Filtered(f) =>
          channels.filter(kv => f(kv._1)).toSeq.traverse(kv => send(kv._1, kv._2)).void
    }

  private def sendOne(member: Fingerprint, event: Assembly.Event): F[Unit] =
    sendMessage(Destination.Selected(Set(member)), event)

  /////////////////////////////////////////////////
  //  State Getters

  private def state(member: Fingerprint, hidding: Boolean = true): F[State[Any]] =
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

  private inline def participants: F[Set[Fingerprint]] =
    refStatus.get.map(_.participants)

  private inline def present: F[Set[Fingerprint]] =
    refChannels.get.map(_.keySet)

  private inline def connectionIdOf(member: Fingerprint): F[Option[UUID]] =
    refChannels.get.map(_.get(member).map(_.id))

  private inline def getAbsent: F[immutable.Map[Fingerprint, Instant]] =
    refAbsent.get

  private def logState(name: String): F[Unit] =
    state(Fingerprint.fromString(""), false).flatMap { (st: State[Any]) =>
      log(Console.CYAN)(
        s"[${Instant.now()}] ${name}: state of assembly ${info.name}:${info.id} ${st.asJson.spaces4} ${Console.RESET}"
      )
    }

  /////////////////////////////////////////////////
  //  Status Reduction

  private def forcedWaiting: F[Status.Waiting] =
    refStatus.get.flatMap {
      case w: Waiting => Sync[F].pure(w)
      case Harvesting(h, _) =>
        present.flatMap { p =>
          val w: Status.Waiting =
            Waiting(
              h.id,
              h.question,
              p.toList.map { m =>
                m -> (
                  if h.participants.contains(m)
                  then Member.Readiness.Ready
                  else Member.Readiness.Answering
                )
              }.toMap
            )
          refStatus.set(w) *> Sync[F].pure(w)
        }
    }

  private def reduceStatus: F[Unit] =
    refStatus.get.flatMap {
      case Waiting(i, q, r) =>
        Async[F].whenA(
          r.size >= minParticipants && r.forall(_._2 === Member.Readiness.Ready)
        ) {
          refStatus.set {
            val participants = r.keys.toSet
            val harvest      = Harvest(i, q, participants)
            Harvesting(harvest, Proposed(participants))
          }
        }
      case Harvesting(h, Proposed(r)) =>
        if h.participants.size < minParticipants
        then forcedWaiting.void
        else if r.isEmpty
        then
          val remaining = h.participants.toList
          for
            _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Hashes(remaining))))
            _ <- sendOne(remaining.head, Assembly.Event.hash(Nil, remaining.tail))
          yield ()
        else Async[F].pure(())
      case Harvesting(h, Started(_)) =>
        Async[F].pure(())
    }

  private def syncNonParticipants[A](f: Set[Fingerprint] => F[A]): F[A] =
    for
      p     <- participants
      a     <- f(p)
      after <- refStatus.get
      _ <-
        if p.nonEmpty && after.isWaiting
        then
          sendMessage(
            Destination.Filtered((x) => !p.contains(x)),
            Assembly.Event.Status(after)
          )
        else Async[F].pure(())
    yield a

  /////////////////////////////////////////////////
  //  Conditions

  inline def whenPresent[A](member: Fingerprint)(f: Connection.Handler[F] => F[A]): F[Option[A]] =
    refChannels.get.map(_.get(member)).flatMap {
      case Some(h) => f(h).map(Some(_))
      case None    => Async[F].pure(None)
    }

  inline def whenRegisteredConnection[A](member: Fingerprint, connectionId: UUID)(
      f: Connection.Handler[F] => F[A]
  ): F[Option[A]] =
    refChannels.get.map(_.get(member)).flatMap {
      case Some(h) if h.id === connectionId => f(h).map(Some(_))
      case _                                => Async[F].pure(None)
    }

  inline def whenNotAbsent[A](member: Fingerprint)(f: => F[A]): F[Option[A]] =
    refAbsent.get.map(!_.contains(member)).flatMap {
      case true  => f.map(Some(_))
      case false => Async[F].pure(None)
    }

  inline def whenNotReady[A](member: Fingerprint)(f: Waiting => F[A]): F[Option[A]] =
    whenPresent(member) { _ =>
      refStatus.get.flatMap {
        case w @ Waiting(i, q, r) if r.get(member) =!= Some(Member.Readiness.Ready) =>
          f(w).map(Some(_))
        case _ =>
          Async[F].pure(None)
      }
    }.map(_.flatten)

  inline def whenSome[A, B](o: Option[A])(f: A => F[B]): F[Option[B]] =
    o match
      case Some(a) => f(a).map(Some(_))
      case _       => Async[F].pure(None)

  inline def withWaiting[A](f: Waiting => F[A]): F[Option[A]] =
    refStatus.get.flatMap {
      case w: Waiting => f(w).map(Some(_))
      case _          => Async[F].pure(None)
    }

  inline def canInvalide[A](
      member: Fingerprint
  )(f: (Harvest, HarvestProtocol) => F[A]): F[Option[A]] =
    refStatus.get.flatMap {
      case Harvesting(h, Started(p)) if h.participants.contains(member) => f(h, p).map(Some(_))
      case _                                                            => Async[F].pure(None)
    }

  /////////////////////////////////////////////////
  //  State - 1 - Only State Change - No reduction

  private def setAbsent(member: Fingerprint): F[Option[Instant]] =
    whenNotAbsent(member) {
      for
        // Ensure not present
        chanells <- refChannels.get
        _ <- whenSome(chanells.get(member)) { handler =>
          handler.close().attempt *> refChannels.set(chanells - member)
        }
        // Erase readiness
        _ <- refStatus.get.flatMap {
          case Waiting(i, q, r) =>
            refStatus.set(Waiting(i, q, r - member))
          case Harvesting(h, _) if h.participants.contains(member) =>
            forcedWaiting.void
          case _ =>
            Async[F].pure(())
        }
        // Set as absent
        i <- Async[F].realTimeInstant
        _ <- refAbsent.modify((x) => (x + (member -> i), ()))
      yield i
    }

  private def cleanAbsent(n: Int): F[Unit] =
    for
      q <- refAbsent.modify { x =>
        val absent = x.toList.sortBy(-_._2.toEpochMilli())
        val keep   = absent.take(n).toMap
        val remove = absent.drop(n).map(_._1)
        (keep, remove)
      }
      _ <- q.traverse(identityProofStore.delete)
    yield ()

  enum SetPresentResult:
    case Ok, NoIdentityProof, AlreadyPresent

  private def setPresent(member: Fingerprint, handler: Connection.Handler[F]): F[SetPresentResult] =
    identityProofStore.fetch(member).flatMap {
      case Some(_) =>
        refChannels.get.map(_.contains(member)).flatMap {
          case true =>
            Async[F].pure(SetPresentResult.AlreadyPresent)
          case false =>
            for
              // Ensure not absent
              _ <- refAbsent.modify((m) => (m - member, ()))
              _ <- withWaiting { case Waiting(i, q, r) =>
                refStatus.set(Waiting(i, q, r + (member -> Member.Readiness.Answering)))
              }
              _ <- refChannels.modify((m) => (m + (member -> handler), ()))
            yield SetPresentResult.Ok
        }
      case None =>
        Async[F].pure(SetPresentResult.NoIdentityProof)
    }

  private def setReady(member: Fingerprint): F[Boolean] =
    refStatus.get.flatMap {
      case Waiting(i, q, r)
          if r.contains(member) && r.get(member) =!= Some(Member.Readiness.Ready) =>
        refStatus.set(Waiting(i, q, r + (member -> Member.Readiness.Ready))).map(_ => true)
      case _ =>
        Async[F].pure(false)
    }

  private def forcedWaiting(harvest: Harvest, member: Option[Fingerprint]): F[Unit] =
    present
      .flatMap { p =>
        refStatus.set {
          Waiting(
            harvest.id,
            harvest.question,
            p.toList.map { m =>
              m -> (
                if (Some(m): Option[Fingerprint]) === member
                then Member.Readiness.Blocking
                else if harvest.participants.contains(m)
                then Member.Readiness.Ready
                else Member.Readiness.Answering
              )
            }.toMap
          )
        }
      }

  private def setBlocking(member: Fingerprint): F[Boolean] =
    refStatus.get.flatMap {
      case Waiting(i, q, r)
          if r.contains(member) && r.get(member) =!= Some(Member.Readiness.Blocking) =>
        refStatus.set(Waiting(i, q, r + (member -> Member.Readiness.Blocking))).map(_ => true)
      case Harvesting(h, Proposed(r)) if h.participants.contains(member) && r.contains(member) =>
        forcedWaiting(h, Some(member)).map(_ => true)
      case _ =>
        Async[F].pure(false)
    }

  private def setAccept(member: Fingerprint): F[Boolean] =
    refStatus.get.flatMap {
      case Harvesting(h, Proposed(r)) if h.participants.contains(member) && r.contains(member) =>
        refStatus.set(Harvesting(h, Proposed(r - member))).map(_ => true)
      case _ =>
        Async[F].pure(false)
    }

  private def setRefuse(member: Fingerprint): F[Boolean] =
    refStatus.get.flatMap {
      case Harvesting(h, Proposed(r)) if h.participants.contains(member) && r.contains(member) =>
        forcedWaiting(h, None).map(_ => true)
      case _ =>
        Async[F].pure(false)
    }

  private def registerIdentityProof(id: IdentityProof): F[Unit] =
    if id.isValid
    then
      identityProofStore.fetch(id.fingerprint).flatMap {
        case Some(id2) =>
          if id === id2
          then Async[F].pure(())
          else
            Async[F].raiseError(
              new Exception("Trying to register another identity proof with same fingerprint")
            )
        case None =>
          identityProofStore.store(id)
      }
    else Async[F].raiseError(new Exception("Trying to register an invalid identity proof"))

  ////////////////////////////////////////////////////////
  //  State - 2 - Full Change + Reduction - No Entry Point

  private def softRemoveMember(member: Fingerprint): F[Option[Instant]] =
    syncNonParticipants { _ =>
      for
        i <- setAbsent(member)
        _ <- whenSome(i) { x =>
          for
            _ <- sendMessage(Destination.All, Assembly.Event.absent(member, x))
            _ <- reduceStatus
            _ <- cleanAbsent(absentSize)
          yield ()
        }
      yield i
    }

  private def tryHardPresent(
      member: Fingerprint,
      handler: Connection.Handler[F],
      idOpt: Option[IdentityProof]
  ): F[Unit] =
    whenSome(idOpt)(registerIdentityProof(_)) *>
      setPresent(member, handler).flatMap {
        case SetPresentResult.Ok =>
          Async[F].pure(())
        case SetPresentResult.NoIdentityProof =>
          Async[F].raiseError(
            new Exception(
              s"No identity proof for member ${member} in assembly ${info.name}:${info.id}"
            )
          )
        case SetPresentResult.AlreadyPresent =>
          sendOne(
            member,
            Assembly.Event.Error("Already connected elsewhere.", true)
          ) *> softRemoveMember(member) *> setPresent(member, handler).flatMap {
            case SetPresentResult.Ok => Async[F].pure(())
            case s                   => Async[F].raiseError(new Exception(s"$s"))
          }
      }

  def invalidate: F[Boolean] =
    refStatus.get.flatMap {
      case Harvesting(_, Started(_)) =>
        syncNonParticipants { p =>
          for
            _ <- forcedWaiting
            _ <- sendMessage(
              Destination.Selected(p),
              Assembly.Event.invalid
            )
            _ <- reduceStatus
          yield true
        }
      case _ =>
        Async[F].pure(false)
    }

  def invalidateOnError[A](f: F[A]): F[A] =
    f.handleErrorWith { e =>
      invalidate *> Async[F].raiseError(e)
    }

  def setHarvestProtocol(harvestProtocol: HarvestProtocol): F[HarvestProtocol] =
    refStatus.get.flatMap {
      case Harvesting(p, Started(hp)) =>
        refStatus.set(Harvesting(p, Started(harvestProtocol))).map(_ => hp)
      case _ =>
        Async[F].raiseError(new Exception("Status is not in started phase."))
    }

  def verifySignature(
      harvest: Harvest,
      hashes: List[Base64UrlEncoded],
      member: Fingerprint,
      signature: Signature[HarvestProtocol.Proof]
  ): F[Boolean] =
    identityProofStore.fetch(member).flatMap {
      case Some(ip) =>
        Async[F].delay {
          withVerify[Boolean](ip.verify.toECPublicKey) { f =>
            given Signable[HarvestProtocol.Proof] =
              Signable.fromEncoder[HarvestProtocol.Proof]
            f[HarvestProtocol.Proof](
              Signed(
                HarvestProtocol.Proof(harvest, hashes),
                signature
              )
            )
          }
        }
      case None =>
        Async[F].raiseError(new Exception(s"No identity proof for member ${member}"))
    }

  def harvestDone(newQuestions: Option[List[Question]]): F[Unit] =
    for
      id      <- Async[F].delay(UUID.randomUUID())
      members <- present
      qs      <- refQuestions.get
      validQS = newQuestions.getOrElse(qs)
      _ <- refStatus.set(
        Waiting(id, validQS.headOption, members.toList.map(_ -> Member.Readiness.Answering).toMap)
      )
      _ <- refQuestions.set(validQS.drop(1))
      _ <- sendMessage(
        Destination.All,
        Assembly.Event.Public(newQuestions match
          case Some(l) => State.Event.NewQuestions(id, l)
          case None    => State.Event.QuestionDone(id)
        )
      )
    yield ()

  /////////////////////////////////////////////////
  //  Entry Points

  def closeIfEmpty: F[Unit] =
    stateMutex.permit.surround {
      for
        channels <- refChannels.get
        _        <- Async[F].whenA(channels.isEmpty)(close)
      yield ()
    }

  def removeMember(member: Member.Fingerprint): F[Unit] =
    stateMutex.permit.surround {
      for
        i <- softRemoveMember(member)
        _ <- whenSome(i) { x =>
          for
            channels <- refChannels.get
            _        <- Async[F].whenA(channels.isEmpty)(close)
          yield ()
        }
      yield ()
    }

  def memberChannel(
      member: Member.Fingerprint,
      handler: Connection.Handler[F],
      establish: State[Any] => F[Unit],
      identityProof: Option[IdentityProof]
  ): F[Unit] =
    stateMutex.permit.surround {
      for
        _  <- tryHardPresent(member, handler, identityProof)
        st <- state(member)
        _ <- establish(st).handleErrorWith { e =>
          softRemoveMember(member) *> Async[F].raiseError(e)
        }
        _ <- sendMessage(Destination.Filtered(_ =!= member), Assembly.Event.present(member))
        _ <- reduceStatus
      yield ()
    }

  def memberMessage(
      connectionId: UUID,
      member: Member.Fingerprint,
      message: Member.Event
  ): F[Unit] =
    import Member.Event.*
    stateMutex.permit.surround {
      whenRegisteredConnection(member, connectionId) { _ =>
        message match
          case Member.Event.Blocking(Member.Readiness.Ready) =>
            for
              b <- setReady(member)
              _ <- Async[F].whenA(b)(
                sendMessage(
                  Destination.All,
                  Assembly.Event.ready(member)
                ) *> reduceStatus
              )
            yield ()
          case Blocking(Member.Readiness.Blocking) =>
            syncNonParticipants { _ =>
              for
                b <- setBlocking(member)
                _ <- Async[F].whenA(b)(
                  sendMessage(
                    Destination.All,
                    Assembly.Event.blocking(member)
                  ) *> reduceStatus
                )
              yield ()
            }
          case Accept =>
            for
              b <- setAccept(member)
              _ <- Async[F].whenA(b)(
                participants.flatMap(p =>
                  sendMessage(
                    Destination.Selected(p),
                    Assembly.Event.accept(member)
                  )
                ) *> reduceStatus
              )
            yield ()
          case Refuse =>
            syncNonParticipants { p =>
              for
                b <- setRefuse(member)
                _ <- Async[F].whenA(b)(
                  sendMessage(
                    Destination.Selected(p),
                    Assembly.Event.refuse(member)
                  ) *> reduceStatus
                )
              yield ()
            }
          case Invalid =>
            canInvalide(member) { (_, _) =>
              invalidate
            }.void
          case Harvesting(harvestEvent) =>
            refStatus.get.flatMap {
              case Status.Harvesting(h, Started(phase)) if h.participants.contains(member) =>
                invalidateOnError(phaseEvent(h, phase, member, harvestEvent))
              case st =>
                logState(
                  s"Ignoring event ${harvestEvent} from ${member} in assembly ${info.name}:${info.id}"
                )
            }
      }.void
    }

  private def phaseEvent(
      harvest: Harvest,
      phase: HarvestProtocol,
      member: Fingerprint,
      event: Member.HarvestingEvent
  ): F[Unit] =
    import HarvestProtocol.{Hashes => SHashes, Ballots => SBallots, *}
    import Member.HarvestingEvent.{Hashes => MHashes, Ballots => MBallots, *}
    (phase, event) match
      case (SHashes(current :: next :: tl), NextHash(hashes)) if member === current =>
        if hashes.isSorted
        then
          setHarvestProtocol(SHashes(next :: tl)) *> sendOne(next, Assembly.Event.hash(hashes, tl))
        else invalidate.void

      case (SHashes(current :: Nil), MHashes(hashes)) if member === current =>
        if hashes.isSorted
        then
          setHarvestProtocol(Verification(hashes, immutable.Map.empty)) *> sendMessage(
            Destination.Selected(harvest.participants),
            Assembly.Event.Protocol(HarvestProtocol.Event.Validate(hashes))
          )
        else invalidate.void

      case (Verification(hashes, signatures), Valid(sig))
          if !signatures.contains(member) && harvest.participants.contains(member) =>
        verifySignature(harvest, hashes, member, sig).flatMap {
          case true =>
            val newSignatures = signatures + (member -> sig)
            if newSignatures.size == harvest.participants.size
            then
              val remaining = harvest.participants.toList
              setHarvestProtocol(SBallots(hashes, newSignatures, remaining)) *>
                sendMessage(
                  Destination.Selected(harvest.participants),
                  Assembly.Event.validity(newSignatures)
                ) *>
                sendOne(
                  remaining.head,
                  Assembly.Event.ballot(Nil, remaining.tail)
                )
            else setHarvestProtocol(Verification(hashes, newSignatures)).void
          case false =>
            logState(s"Signaure for member ${member} is not valid!") *>
              invalidate.void
        }
      case (SBallots(hashes, sigs, current :: next :: tl), NextBallot(ballots))
          if member === current =>
        if ballots.isSorted
        then
          setHarvestProtocol(SBallots(hashes, sigs, next :: tl)) *> sendOne(
            next,
            Assembly.Event.ballot(ballots, tl)
          )
        else invalidate.void

      case (SBallots(hashes, sigs, current :: Nil), MBallots(ballots)) if member === current =>
        val expectedBallotType =
          harvest.question match
            case Some(q) => Ballot.Kind.Answer(q.kind)
            case None    => Ballot.Kind.Question

        val check: Option[String] =
          if !ballots.map(_.asJson.noSpacesSortKeys).isSorted
          then Some("Ballots not sorted!")
          else if !ballots.forall(_.kind === expectedBallotType)
          then Some(s"Ballots not of exected type ${expectedBallotType}")
          if !Ballot.verifyHashes(hashes, ballots)
          then
            Some(
              s"Ballot verification failed! ballots=${ballots.asJson.noSpacesSortKeys}, hashes=${hashes.asJson.noSpacesSortKeys}"
            )
          else None

        check match {
          case Some(error) =>
            logState(s"Ballots error ${error}") *> invalidate.void
          case None =>
            sendMessage(
              Destination.Selected(harvest.participants),
              Assembly.Event.Protocol(HarvestProtocol.Event.Ballots(ballots))
            ) *>
              harvestDone(expectedBallotType match
                case Ballot.Kind.Question  => Some(Ballot.questions(ballots))
                case Ballot.Kind.Answer(_) => None
              )

        }
      case (_, _) =>
        logState(s"Ingoring message ${event} from member ${member} in state ${phase}.")

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
      refQuestons <- Ref.of(List.empty[Question]) // (2 to 5).map(n => s"Question ${n}").toList)
      status      <- Status.init
      refStatus   <- Ref.of(status)
    // Status.Waiting(UUID.randomUUID(), Some("Question 1"), immutable.Map.empty)) FOR DEBUG TODO REMOVE
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
    inline def ready(member: Fingerprint) =
      Event.Public(State.Event.MemberBlocking(member, Member.Readiness.Ready))

    inline def blocking(member: Fingerprint) =
      Event.Public(State.Event.MemberBlocking(member, Member.Readiness.Blocking))

    inline def present(member: Fingerprint) =
      Event.Public(State.Event.MemberPresence(member, Member.Presence.Present))

    inline def absent(member: Fingerprint, i: Instant) =
      Event.Public(State.Event.MemberPresence(member, Member.Presence.Absent(i)))

    inline def accept(member: Fingerprint) =
      Event.Harvesting(Harvest.Event.Accepted(member))

    inline def refuse(member: Fingerprint) =
      Event.Harvesting(Harvest.Event.Refused(member))

    inline def invalid =
      Event.Harvesting(Harvest.Event.Invalid)

    inline def hash(hashes: List[Base64UrlEncoded], remaining: List[Member.Fingerprint]) =
      Assembly.Event.Protocol(HarvestProtocol.Event.Hash(hashes, remaining))

    inline def validity(signatures: Map[Member.Fingerprint, Signature[HarvestProtocol.Proof]]) =
      Assembly.Event.Protocol(HarvestProtocol.Event.Validity(signatures))

    inline def ballot(reals: List[Base64UrlEncoded], remaining: List[Member.Fingerprint]) =
      Assembly.Event.Protocol(HarvestProtocol.Event.Ballot(reals, remaining))

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
