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

/* ASSUMPTIONS:

   Member.Fingerprint => member identity proof registered!
 */
trait Assembly[F[_]]:
  def info: assembly.Info
  def state: F[assembly.State]

  def registerMember(id: IdentityProof): F[Unit]
  def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]]
  def memberReady(member: Member.Fingerprint): F[Unit]
  def removeMember(member: Member.Fingerprint): F[Unit]
  def memberChannel(
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  ): F[Unit]

  inline final def memberMessage(member: Member.Fingerprint, message: MemberEvent): F[Unit] =
    import MemberEvent.*
    message match
      case Ready => memberReady(member)

object Assembly:

  inline def inMemory[F[_]: Sync](assemblyInfo: assembly.Info, deleteMe: F[Unit]): Assembly[F] =
    new Assembly[F]:
      private val idStore: IdentityProofStore[F] =
        IdentityProofStore.inMemory[F]

      private val presence                = mutable.Map.empty[Member.Fingerprint, Member.Presence]
      private var questions: List[String] = Nil
      private var status: State.Status    = State.Status.Waiting(None, immutable.Map.empty)

      private val channels =
        mutable.Map.empty[Member.Fingerprint, AssemblyEvent => F[Unit]]

      val info: assembly.Info = assemblyInfo

      def state: F[State] =
        Sync[F].delay(
          State(
            questions = questions,
            presences = presence.toMap,
            status = status
          )
        )

      def registerMember(id: IdentityProof): F[Unit] =
        if id.isValid
        then
          idStore.fetch(id.fingerprint).flatMap {
            case Some(id2) =>
              if id === id2
              then Sync[F].pure(())
              else
                Sync[F].raiseError(
                  new Exception("Trying to register another identity proof with same fingerprint")
                )
            case None =>
              idStore.store(id) *> Sync[F].delay {
                presence.addOne(id.fingerprint -> Member.Presence.Absent(Instant.now()))
              }
          }
        else Sync[F].raiseError(new Exception("Trying to register an invalid identity proof"))

      def identityProof(fp: Member.Fingerprint): F[Option[IdentityProof]] =
        idStore.fetch(fp)

      def messageAll(event: AssemblyEvent): F[Unit] =
        for
          chs <- Sync[F].delay(channels.values)
          _   <- chs.toList.traverse(ch => ch(event).attempt.void)
        yield ()

      private def memberReadiness(member: Member.Fingerprint): Option[Member.Readiness] =
        import State.Status.*
        status match
          case Waiting(_, r) =>
            r.get(member)
          case _ =>
            None

      def memberReady(member: Member.Fingerprint): F[Unit] =
        Sync[F]
          .delay {
            if presence.get(member) === Some(Member.Presence.Present) && memberReadiness(
                member
              ) === Some(Member.Readiness.Busy)
            then
              import State.Status.*
              status match
                case Waiting(q, r) =>
                  status = Waiting(q, r + (member -> Member.Readiness.Ready))
                  true
                case _ =>
                  false
            else false
          }
          .flatMap { (b: Boolean) =>
            Sync[F].whenA(b)(messageAll(AssemblyEvent.PublicEvent(State.Event.MemberReady(member))))
          }

      def removeMember(member: Member.Fingerprint): F[Unit] =
        Sync[F]
          .delay {
            if presence.get(member) === Some(Member.Presence.Present)
            then
              val pre = Member.Presence.Absent(Instant.now())
              presence.addOne(member, pre)

              import State.Status.*
              status match
                case Waiting(q, r) =>
                  status = Waiting(q, r - member)
                  true
                case _ =>
                  false

              channels.remove(member)
              Some(pre)
            else None
          }
          .flatMap {
            case Some(pre) =>
              messageAll(AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, pre)))
            case None =>
              Sync[F].pure(())
          }

      def memberChannel(
          member: Member.Fingerprint,
          handler: AssemblyEvent => F[Unit]
      ): F[Unit] =
        for
          oldHandler <- Sync[F].delay(channels.get(member))
          _          <- Sync[F].whenA(oldHandler.nonEmpty)(removeMember(member))
          _ <- oldHandler match
            case Some(h) => h(AssemblyEvent.Error("Double connection!", true)).attempt.void
            case None    => Sync[F].pure(())
          _ <- Sync[F].delay {
            presence.addOne(member, Member.Presence.Present);

            import State.Status.*
            status match
              case Waiting(q, r) =>
                status = Waiting(q, r + (member -> Member.Readiness.Busy))
                true
              case _ =>
                false

            channels.addOne(member, handler)
          }
          st <- state
          _  <- handler(AssemblyEvent.PublicSynchro(st))
          _ <- messageAll(
            AssemblyEvent.PublicEvent(State.Event.MemberPresence(member, Member.Presence.Present))
          )
        yield ()
