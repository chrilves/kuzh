package chrilves.kuzh.back.models

import cats.*
import cats.effect.*
import cats.implicits.*
import cats.syntax.eq.*
import io.circe.*
import io.circe.syntax.*

import java.time.Instant
import scala.collection.*

import chrilves.kuzh.back.models.assembly.*
import chrilves.kuzh.back.services.IdentityProofStore
import java.util.UUID
import cats.effect.kernel.Sync.Type.Blocking
import chrilves.kuzh.back.models.Member.*
import cats.evidence.As
import chrilves.kuzh.back.models.Assembly.StatusType
import cats.effect.std.Semaphore
import chrilves.kuzh.back.models.Assembly.MemberConnection
import chrilves.kuzh.back.models.Assembly.Destination

final class Assembly[F[_]](
    private val identityProofStore: IdentityProofStore[F],
    private val assemblyStateStore: AssemblyStateStore[F],
    private val mutex: Semaphore[F],
    val info: assembly.Info
):

  private final val minParticipants = 3;

  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
    identityProofStore.fetch(fp)

  private def state(member: Member.Fingerprint)(using Sync[F]): F[assembly.State] =
    assemblyStateStore.state.map { st =>
      import State.Status.*
      st.status match
        case _: Waiting => st
        case Proposed(h, _) =>
          if h.participants.contains(member)
          then st
          else st.copy(status = Hidden)
        case Harvesting(h, _) =>
          if h.participants.contains(member)
          then st
          else st.copy(status = Hidden)
        case Hidden => st
    }

  /////////////////////////////////////////////////
  //  WHEN

  private def whenPresent(member: Member.Fingerprint)(f: => F[Unit])(using Sync[F]): F[Unit] =
    assemblyStateStore.presence(member).flatMap {
      case Some(Member.Presence.Present) => f
      case _                             => Sync[F].pure(())
    }

  private def whenReadiness(
      member: Member.Fingerprint
  )(cond: Member.Readiness => Boolean)(f: => F[Unit])(using Sync[F]): F[Unit] =
    assemblyStateStore.readiness(member).flatMap {
      case Some(r) if cond(r) => f
      case _                  => Sync[F].pure(())
    }

  private def whenParticipant(
      member: Member.Fingerprint
  )(cond: Boolean => Boolean)(f: => F[Unit])(using Sync[F]): F[Unit] =
    assemblyStateStore.acceptance(member).flatMap {
      case Some(b) if cond(b) => f
      case _                  => Sync[F].pure(())
    }

  private inline def whenM(cond: F[Boolean])(f: => F[Unit])(using Sync[F]): F[Unit] =
    cond.flatMap(b => Sync[F].whenA(b)(f))

  /////////////////////////////////////////////////
  //  Messages

  private def sendMessage(to: Destination, event: AssemblyEvent)(using
      Sync[F]
  ): F[Unit] =
    for
      st <- assemblyStateStore.state
      _ <- Sync[F].delay(
        println(
          s"${Console.YELLOW}[${java.time.Instant.now()}] State ${st.asJson.spaces4}${Console.RESET}"
        )
      )
      _ <- Sync[F].delay(println(s"${Console.MAGENTA}[${java.time.Instant
          .now()}] Sending to ${to}: ${event.asJson.spaces4}${Console.RESET}"))
      connections <- assemblyStateStore.getConnections(to)
      _           <- connections.traverse(_(event).attempt)
    yield ()

  private def reduceStatus(using Sync[F]): F[Unit] =
    assemblyStateStore.statusType.flatMap {
      case StatusType.Waiting =>
        assemblyStateStore.presents.flatMap { n =>
          Sync[F].whenA(n >= minParticipants) {
            whenM(assemblyStateStore.allReady) {
              assemblyStateStore.switchStatusType(StatusType.Proposed)
            }
          }
        }
      case StatusType.Proposed =>
        assemblyStateStore.nbParticipants.flatMap { n =>
          if (n < minParticipants)
            assemblyStateStore.switchStatusType(StatusType.Waiting) *> reduceStatus
          else
            assemblyStateStore.allAccepted.flatMap(b =>
              Sync[F].whenA(b) {
                for _ <- assemblyStateStore.switchStatusType(StatusType.Harvesting)
                yield ()
              }
            )
        }
      case StatusType.Harvesting =>
        Sync[F].pure(())
    }

  private def ensureNonPresentSynchro(using Sync[F]): F[Unit] =
    for
      s1 <- assemblyStateStore.statusType
      np <-
        if s1 =!= StatusType.Waiting
        then assemblyStateStore.nonParticipants
        else Sync[F].pure(Set.empty)
      _  <- reduceStatus
      s2 <- assemblyStateStore.statusType
      _ <- Sync[F].whenA(s2 === StatusType.Waiting && s1 =!= StatusType.Waiting) {
        for
          status <- assemblyStateStore.status
          _      <- sendMessage(Destination.Selected(np), AssemblyEvent.StatusSynchro(status))
        yield ()
      }
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
            identityProofStore.store(id) *> unsafeRemoveMember(id.fingerprint)
        }
      }
    else Sync[F].raiseError(new Exception("Trying to register an invalid identity proof"))

  private def unsafeRemoveMember(member: Member.Fingerprint)(using Sync[F]): F[Unit] =
    whenPresent(member) {
      Sync[F].realTimeInstant.flatMap { i =>
        val presence = Member.Presence.Absent(Instant.now())
        for
          _ <- assemblyStateStore.closeConnection(member)
          _ <- assemblyStateStore.setPresence(member, presence)
          _ <- assemblyStateStore.statusType.flatMap {
            case StatusType.Waiting =>
              assemblyStateStore.setReadiness(member, None) *> reduceStatus
            case StatusType.Proposed =>
              whenParticipant(member)(_ => true) {
                for
                  _ <- assemblyStateStore.removeParticipant(member)
                  _ <- assemblyStateStore.resetAcceptance
                  _ <- ensureNonPresentSynchro
                yield ()
              }
            case _ =>
              Sync[F].pure(())
          }
          _ <- sendMessage(
            Destination.All,
            AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, presence))
          )
        yield ()
      }
    }

  def removeMember(member: Member.Fingerprint)(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      unsafeRemoveMember(member: Member.Fingerprint)
    }

  def memberMessage(member: Member.Fingerprint, message: MemberEvent)(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      message match
        case MemberEvent.Blocking(b) =>
          memberBlocking(member, b)
        case MemberEvent.AcceptHarvest =>
          whenParticipant(member)(!_) {
            for
              _ <- assemblyStateStore.accept(member)
              _ <- sendMessage(
                Destination.Participants,
                AssemblyEvent.PublicEvent(State.Event.HarvestAccepted(member))
              )
              _ <- reduceStatus
            yield ()
          }
    }

  private def memberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)(using
      Sync[F]
  ): F[Unit] =
    import Assembly.*
    assemblyStateStore.statusType.flatMap {
      case StatusType.Waiting =>
        whenReadiness(member)(_ =!= blocking) {
          for
            _ <- assemblyStateStore.setReadiness(member, Some(blocking))
            _ <- reduceStatus
            _ <- sendMessage(
              Destination.All,
              AssemblyEvent.PublicEvent(State.Event.MemberBlocking(member, blocking))
            )
          yield ()
        }
      case StatusType.Proposed =>
        whenParticipant(member)(!_) {
          Sync[F].whenA((blocking: Member.Readiness) === Member.Readiness.Blocking) {
            for
              _ <- sendMessage(
                Destination.Participants,
                AssemblyEvent.PublicEvent(
                  State.Event.MemberBlocking(member, Member.Readiness.Blocking)
                )
              )
              np     <- assemblyStateStore.nonParticipants
              _      <- assemblyStateStore.switchStatusType(StatusType.Waiting)
              _      <- assemblyStateStore.setReadiness(member, Some(Member.Readiness.Blocking))
              status <- assemblyStateStore.status
              _      <- sendMessage(Destination.Selected(np), AssemblyEvent.StatusSynchro(status))
            yield ()
          }
        }
      case StatusType.Harvesting =>
        Sync[F].pure(())
    }

  def memberChannel(
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  )(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      for
        oldHandler <- assemblyStateStore.getConnection(member)
        _ <- oldHandler match
          case Some(h) =>
            h(AssemblyEvent.Error("Double connection!", true)).attempt.void *> unsafeRemoveMember(
              member
            )
          case None => Sync[F].pure(())
        _ <- assemblyStateStore.setPresence(member, Member.Presence.Present)
        t <- assemblyStateStore.statusType
        _ <- Sync[F].whenA(t === StatusType.Waiting)(
          assemblyStateStore.setReadiness(member, Some(Member.Readiness.Answering))
        )
        _  <- assemblyStateStore.setConnection(member, handler)
        st <- state(member)
        _  <- sendMessage(Destination.Selected(Set(member)), AssemblyEvent.PublicSynchro(st))
        _ <- sendMessage(
          Destination.All,
          AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, Member.Presence.Present))
        )
      yield ()
    }

object Assembly:
  enum StatusType:
    case Waiting, Proposed, Harvesting

  object StatusType:
    given Eq[StatusType] = Eq.fromUniversalEquals

  final case class MemberConnection[F[_]](
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  )

  enum Destination:
    case All
    case Selected(members: Set[Member.Fingerprint])
    case Participants

trait AssemblyStateStore[F[_]]:
  def setPresence(member: Fingerprint, presence: Member.Presence): F[Unit]
  def presence(member: Fingerprint): F[Option[Member.Presence]]
  def presents: F[Int]
  def cleanPresence(from: Instant): F[Unit]

  def getConnection(member: Fingerprint): F[Option[AssemblyEvent => F[Unit]]]
  def getConnections(destination: Destination): F[List[AssemblyEvent => F[Unit]]]
  def setConnection(member: Fingerprint, handler: AssemblyEvent => F[Unit]): F[Unit]
  def closeConnection(member: Fingerprint): F[Unit]

  def setReadiness(member: Fingerprint, readiness: Option[Member.Readiness]): F[Unit]
  def readiness(member: Fingerprint): F[Option[Member.Readiness]]
  def allReady: F[Boolean]

  def removeParticipant(member: Fingerprint): F[Unit]
  def nonParticipants: F[Set[Fingerprint]]
  def nbParticipants: F[Int]
  def isParticipant(member: Fingerprint): F[Boolean]

  def accept(member: Fingerprint): F[Unit]
  def acceptance(member: Fingerprint): F[Option[Boolean]]
  def resetAcceptance: F[Unit]
  def allAccepted: F[Boolean]

  def status: F[State.Status]
  def statusType: F[Assembly.StatusType]
  def switchStatusType(statusType: StatusType): F[Unit]

  def state: F[State]

object AssemblyStateStore:

  inline def inMemory[F[_]: Sync](minParticipants: Int): AssemblyStateStore[F] =
    new AssemblyStateStore[F]:
      private val presence = mutable.Map.empty[Member.Fingerprint, Member.Presence]
      private var _status: State.Status =
        State.Status.Waiting(java.util.UUID.randomUUID(), None, immutable.Map.empty)
      private val channels = mutable.Map.empty[Member.Fingerprint, AssemblyEvent => F[Unit]]

      def state: F[State] =
        Sync[F].delay(
          State(
            questions = Nil,
            presences = presence.toMap,
            status = _status
          )
        )

      def status: F[State.Status] =
        Sync[F].delay(
          _status
        )

      def setPresence(member: Fingerprint, pres: Member.Presence): F[Unit] =
        Sync[F].delay(presence.addOne(member, pres))

      def presence(member: Fingerprint): F[Option[Member.Presence]] =
        Sync[F].delay(presence.get(member))

      def presents: F[Int] =
        Sync[F].delay(presence.count(_._2 === Member.Presence.Present))

      def cleanPresence(from: Instant): F[Unit] =
        Sync[F].delay {
          val toRemove = presence
            .filter { kv =>
              kv._2 match
                case Member.Presence.Absent(i) => i.isBefore(from)
                case _                         => false
            }
            .keys
            .toList

          for member <- toRemove
          do presence.remove(member)
        }

      private def participants: F[immutable.Set[Fingerprint]] =
        Sync[F].delay {
          import State.Status.*
          _status match
            case _: Waiting =>
              immutable.Set.empty
            case Proposed(h, _) =>
              h.participants
            case Harvesting(h, _) =>
              h.participants
            case Hidden =>
              immutable.Set.empty
        }

      def nonParticipants: F[Set[Fingerprint]] =
        Sync[F].delay {
          import State.Status.*
          _status match
            case _: Waiting =>
              immutable.Set.empty
            case Proposed(h, _) =>
              channels.filter(kv => !h.participants.contains(kv._1)).keySet
            case Harvesting(h, _) =>
              channels.filter(kv => !h.participants.contains(kv._1)).keySet
            case Hidden =>
              immutable.Set.empty
        }

      def nbParticipants: F[Int] =
        Sync[F].delay {
          import State.Status.*
          _status match
            case _: Waiting =>
              0
            case Proposed(h, _) =>
              h.participants.size
            case Harvesting(h, _) =>
              h.participants.size
            case Hidden =>
              0
        }

      def getConnection(member: Fingerprint): F[Option[AssemblyEvent => F[Unit]]] =
        Sync[F].delay(channels.get(member))

      def getConnections(destination: Destination): F[List[AssemblyEvent => F[Unit]]] =
        destination match
          case Destination.All =>
            Sync[F].delay(channels.values.toList)
          case Destination.Selected(members) =>
            Sync[F].delay {
              channels.filter(kv => members.contains(kv._1)).values.toList
            }
          case Destination.Participants =>
            participants.flatMap { p =>
              Sync[F].delay {
                channels.filter(kv => p.contains(kv._1)).values.toList
              }
            }

      def setConnection(member: Fingerprint, handler: AssemblyEvent => F[Unit]): F[Unit] =
        Sync[F].delay(channels.addOne(member -> handler))

      def closeConnection(member: Fingerprint): F[Unit] =
        Sync[F].delay {
          channels.get(member) match
            case Some(h) => h(AssemblyEvent.Error("please close", true))
            case _       => ()
        }

      def setReadiness(member: Fingerprint, readiness: Option[Member.Readiness]): F[Unit] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Waiting(id, q, readys) =>
              val nr = readiness match
                case Some(r) => readys + (member -> r)
                case None    => readys - member
              _status = Waiting(id, q, nr)
            case _ =>
              ()
        }

      def readiness(member: Fingerprint): F[Option[Member.Readiness]] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Waiting(_, _, readys) =>
              readys.get(member)
            case _ =>
              None
        }

      def allReady: F[Boolean] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Waiting(_, _, readys) =>
              readys.forall(_._2 === Member.Readiness.Ready)
            case _ =>
              false
        }

      def accept(member: Fingerprint): F[Unit] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(h, r) =>
              _status = Proposed(h, r - member)
            case _ =>
              ()
        }

      def acceptance(member: Fingerprint): F[Option[Boolean]] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(h, r) =>
              if h.participants.contains(member)
              then Some(!r.contains(member))
              else None
            case _ =>
              None
        }

      def removeParticipant(member: Fingerprint): F[Unit] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(h, r) =>
              _status = Proposed(h.copy(participants = h.participants - member), r - member)
            case _ =>
              ()
        }

      def resetAcceptance: F[Unit] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(h, r) =>
              _status = Proposed(h, h.participants)
            case _ =>
              ()
        }

      def allAccepted: F[Boolean] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(_, r) =>
              r.isEmpty
            case _ =>
              false
        }

      def isParticipant(member: Fingerprint): F[Boolean] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case Proposed(h, r) =>
              h.participants.contains(member)
            case Harvesting(h, _) =>
              h.participants.contains(member)
            case _ =>
              false
        }

      def statusType: F[Assembly.StatusType] =
        import State.Status.*
        Sync[F].delay {
          _status match
            case _: Waiting    => Assembly.StatusType.Waiting
            case _: Proposed   => Assembly.StatusType.Proposed
            case _: Harvesting => Assembly.StatusType.Harvesting
            case Hidden        => Assembly.StatusType.Harvesting
        }

      def switchStatusType(statusType: StatusType): F[Unit] =
        import State.Status.*
        Sync[F].delay {
          (_status, statusType) match
            case (Waiting(id, q, r), StatusType.Proposed) =>
              val participants = r.keys.toSet
              val harvest      = Harvest(id, q, participants)
              _status = Proposed(harvest, participants)
            case (Proposed(harvest, participants), StatusType.Waiting) =>
              _status = Waiting(
                harvest.id,
                harvest.question,
                harvest.participants.map(member => member -> Member.Readiness.Ready).toMap ++
                  channels
                    .filter(kv => !harvest.participants.contains(kv._1))
                    .map(kv => kv._1 -> Member.Readiness.Answering)
              )
            case (Proposed(harvest, participants), StatusType.Harvesting) =>
              ()

            case (_, _) =>
              ()
        }
