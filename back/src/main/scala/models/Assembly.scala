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

final class Assembly[F[_]](
    private val identityProofStore: IdentityProofStore[F],
    private val assemblyStateStore: AssemblyStateStore[F],
    val info: assembly.Info
):
  def state: F[assembly.State[Harvest]] =
    assemblyStateStore.state

  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
    identityProofStore.fetch(fp)

  def whenPresent(member: Member.Fingerprint)(f: => F[Unit])(using Sync[F]): F[Unit] =
    assemblyStateStore.presence(member).flatMap {
      case Some(Member.Presence.Present) => f
      case _                             => Sync[F].pure(())
    }

  def whenReadiness(
      member: Member.Fingerprint
  )(cond: Member.Readiness => Boolean)(f: => F[Unit])(using Sync[F]): F[Unit] =
    whenPresent(member) {
      assemblyStateStore.readiness(member).flatMap {
        case Some(Member.Readiness.Answering) => f
        case _                                => Sync[F].pure(())
      }
    }

  def sendMessage(to: Option[Member.Fingerprint], event: AssemblyEvent)(using Sync[F]): F[Unit] =
    for
      connections <- to match
        case Some(member) => assemblyStateStore.getConnection(member).map(_.toList)
        case None         => assemblyStateStore.getConnections
      _ <- connections.traverse(f => f(event).attempt.void)
    yield ()

  def registerMember(id: IdentityProof)(using Sync[F]): F[Unit] =
    if id.isValid
    then
      identityProofStore.fetch(id.fingerprint).flatMap {
        case Some(id2) =>
          if id === id2
          then Sync[F].pure(())
          else
            Sync[F].raiseError(
              new Exception("Trying to register another identity proof with same fingerprint")
            )
        case None =>
          identityProofStore.store(id) *> removeMember(id.fingerprint)
      }
    else Sync[F].raiseError(new Exception("Trying to register an invalid identity proof"))

  def removeMember(member: Member.Fingerprint)(using Sync[F]): F[Unit] =
    whenPresent(member) {
      for
        i <- Sync[F].realTimeInstant
        presence = Member.Presence.Absent(Instant.now())
        _ <- assemblyStateStore.setPresence(member, presence)
        _ <- assemblyStateStore.setReadiness(member, None)
        _ <- assemblyStateStore.closeConnection(member)
        _ <- sendMessage(
          None,
          AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, presence))
        )
      yield ()
    }

  def memberMessage(member: Member.Fingerprint, message: MemberEvent)(using Sync[F]): F[Unit] =
    message match
      case MemberEvent.Blocking(b) => memberBlocking(member, b)

  def memberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)(using
      Sync[F]
  ): F[Unit] =
    whenReadiness(member)(r => r =!= Readiness.Answering && r =!= blocking) {
      for
        _ <- assemblyStateStore.setReadiness(member, Some(blocking))
        _ <- sendMessage(
          None,
          AssemblyEvent.PublicEvent(State.Event.MemberBlocking(member, blocking))
        )
      yield ()
    }

  def memberChannel(
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  )(using Sync[F]): F[Unit] =
    for
      oldHandler <- assemblyStateStore.getConnection(member)
      _ <- oldHandler match
        case Some(h) =>
          h(AssemblyEvent.Error("Double connection!", true)).attempt.void *> removeMember(member)
        case None => Sync[F].pure(())
      _  <- assemblyStateStore.setPresence(member, Member.Presence.Present)
      _  <- assemblyStateStore.setReadiness(member, Some(Member.Readiness.Answering))
      _  <- assemblyStateStore.setConnection(member, handler)
      st <- state
      _  <- sendMessage(Some(member), AssemblyEvent.PublicSynchro(st))
      _ <- sendMessage(
        None,
        AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, Member.Presence.Present))
      )
    yield ()

trait AssemblyStateStore[F[_]]:
  def setPresence(member: Fingerprint, presence: Member.Presence): F[Unit]
  def presence(member: Fingerprint): F[Option[Member.Presence]]
  def cleanPresence(from: Instant): F[Unit]

  def setReadiness(member: Fingerprint, readiness: Option[Member.Readiness]): F[Unit]
  def readiness(member: Fingerprint): F[Option[Member.Readiness]]

  def getConnection(member: Fingerprint): F[Option[AssemblyEvent => F[Unit]]]
  def getConnections: F[List[AssemblyEvent => F[Unit]]]
  def setConnection(member: Fingerprint, handler: AssemblyEvent => F[Unit]): F[Unit]
  def closeConnection(member: Fingerprint): F[Unit]

  def state: F[State[Harvest]]

object AssemblyStateStore:

  inline def inMemory[F[_]: Sync]: AssemblyStateStore[F] =
    new AssemblyStateStore[F]:
      private val presence = mutable.Map.empty[Member.Fingerprint, Member.Presence]
      private var status: State.Status[Harvest] = State.Status.Waiting(None, immutable.Map.empty)
      private val id                            = java.util.UUID.randomUUID()
      private val channels = mutable.Map.empty[Member.Fingerprint, AssemblyEvent => F[Unit]]

      def state: F[State[Harvest]] =
        Sync[F].delay(
          State(
            questions = Nil,
            presences = presence.toMap,
            id = id,
            status = status
          )
        )

      def setPresence(member: Fingerprint, pres: Member.Presence): F[Unit] =
        Sync[F].delay(presence.addOne(member, pres))

      def presence(member: Fingerprint): F[Option[Member.Presence]] =
        Sync[F].delay(presence.get(member))

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

      def setReadiness(member: Fingerprint, readiness: Option[Member.Readiness]): F[Unit] =
        import State.Status.*
        Sync[F].delay {
          status match
            case Waiting(q, readys) =>
              val nr = readiness match
                case Some(r) => readys + (member -> r)
                case None    => readys - member
              status = Waiting(q, nr)
            case _ =>
              ()
        }

      def readiness(member: Fingerprint): F[Option[Member.Readiness]] =
        import State.Status.*
        Sync[F].delay {
          status match
            case Waiting(q, readys) =>
              readys.get(member)
            case _ =>
              None
        }

      def getConnection(member: Fingerprint): F[Option[AssemblyEvent => F[Unit]]] =
        Sync[F].delay(channels.get(member))

      def getConnections: F[List[AssemblyEvent => F[Unit]]] =
        Sync[F].delay(channels.values.toList)

      def setConnection(member: Fingerprint, handler: AssemblyEvent => F[Unit]): F[Unit] =
        Sync[F].delay(channels.addOne(member -> handler))

      def closeConnection(member: Fingerprint): F[Unit] =
        Sync[F].delay {
          channels.get(member) match
            case Some(h) => h(AssemblyEvent.Error("please close", true))
            case _       => ()
        }
