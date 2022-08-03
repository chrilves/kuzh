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

import chrilves.kuzh.back.models.Assembly.Destination
import chrilves.kuzh.back.models.assembly.*
import chrilves.kuzh.back.models.assembly.State.*
import chrilves.kuzh.back.models.assembly.Status.*
import chrilves.kuzh.back.models.assembly.Phase.*
import chrilves.kuzh.back.models.Member.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.services.IdentityProofStore

final class Assembly[F[_]] private (
    val info: assembly.Info,
    private val identityProofStore: IdentityProofStore[F],
    private val mutex: Semaphore[F],
    private val refChannels: Ref[F, immutable.Map[Member.Fingerprint, AssemblyEvent => F[Unit]]],
    private val refAbsent: Ref[F, immutable.Map[Fingerprint, Instant]],
    private val refQuestions: Ref[F, List[String]],
    private val refStatus: Ref[F, Status[Nothing]]
):

  private final val minParticipants = 3;

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
    Sync[F].realTimeInstant.flatMap { i => refAbsent.modify(x => (x + (member -> i), i)) }

  /////////////////////////////////////////////////
  //  Messages

  private def sendMessage(to: Destination, event: AssemblyEvent)(using Sync[F]): F[Unit] =
    refChannels.get.flatMap { channels =>
      to match
        case Destination.All =>
          channels.toSeq.traverse(kv => kv._2(event).attempt).void
        case Destination.Selected(members) =>
          members.toSeq.traverse { member =>
            channels.get(member) match
              case Some(handler) =>
                handler(event).attempt.void
              case _ =>
                Sync[F].pure(())
          }.void
        case Destination.Filtered(f) =>
          channels.filter(kv => f(kv._1)).toSeq.traverse(kv => kv._2(event).attempt).void
    }

  /////////////////////////////////////////////////
  //  Status Manipulation

  private def forcedWaiting(before: Status[Nothing], blocking: Option[Fingerprint])(using
      Sync[F]
  ): F[Status.Waiting] =
    def fromHarvest(h: Harvest): F[Waiting] =
      present.map { members =>
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
      }

    before match
      case w @ Waiting(i, q, r) =>
        blocking match
          case Some(m) =>
            Sync[F].pure(Waiting(i, q, r + (m -> Member.Readiness.Blocking)))
          case None =>
            Sync[F].pure(w)
      case Harvesting(h, _) =>
        fromHarvest(h)

  private def reduceStatus(status: Status[Nothing])(using Sync[F]): F[Status[Nothing]] =
    status match
      case Waiting(i, q, r) =>
        Sync[F].pure {
          if r.size >= minParticipants && r.forall(_._2 === Member.Readiness.Ready)
          then
            val participants = r.keys.toSet
            val harvest      = Harvest(i, q, participants)
            Harvesting(harvest, Proposed(participants))
          else status
        }
      case Harvesting(h, Proposed(r)) =>
        if h.participants.size < minParticipants
        then forcedWaiting(status, None).map(x => x)
        else if r.isEmpty
        then
          val remaining = h.participants.toList
          for _ <- sendMessage(
              Destination.Selected(Set(remaining.head)),
              AssemblyEvent.Protocol(HarvestProtocol.Event.Hash(None, remaining.tail))
            )
          yield Harvesting(h, Started(HarvestProtocol.Hashes(remaining)))
        else Sync[F].pure(status)
      case Harvesting(h, Started(_)) =>
        Sync[F].pure(status)

  private def reduceAndSync(participants: Set[Member.Fingerprint], status: Status[Nothing])(using
      Sync[F]
  ): F[Unit] =
    for
      after <- reduceStatus(status)
      _     <- refStatus.set(after)
      _ <-
        if participants.nonEmpty && after.isWaiting
        then
          sendMessage(
            Destination.Filtered((x) => !participants.contains(x)),
            AssemblyEvent.Status(after)
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
        }
      }
    else Sync[F].raiseError(new Exception("Trying to register an invalid identity proof"))

  private def unsafeRemoveMember(member: Member.Fingerprint)(using Sync[F]): F[Unit] =
    refChannels.modify(m => (m - member, m.get(member))).flatMap {
      case Some(handler) =>
        for
          i <- setAbsent(member)
          _ <- handler(AssemblyEvent.Error("Removed member!", true)).attempt
          _ <- sendMessage(
            Destination.All,
            AssemblyEvent.Public(assembly.Event.MemberPresence(member, Member.Presence.Absent(i)))
          )
          _ <- refStatus.get.flatMap {
            case Waiting(i, q, r) =>
              reduceStatus(Waiting(i, q, r - member)).flatMap(refStatus.set)
            case Harvesting(h, phase) if h.participants.contains(member) =>
              val newParticipants = h.participants - member
              val newHarvest      = h.copy(participants = newParticipants)

              phase match
                case Proposed(r) =>
                  reduceAndSync(
                    newParticipants,
                    Harvesting(newHarvest, Proposed(r - member))
                  )
                case Started(_) =>
                  forcedWaiting(
                    Harvesting(newHarvest, Started(HarvestProtocol.Hashes(Nil))),
                    None
                  ).flatMap(x => reduceAndSync(newParticipants, x))
            case _ =>
              Sync[F].pure(())
          }
        yield ()
      case None =>
        Sync[F].pure(())
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
          refStatus.get.flatMap {
            case Harvesting(h, Proposed(r))
                if h.participants.contains(member) && r.contains(member) =>
              for
                after <- reduceStatus(Harvesting(h, Proposed(r - member)))
                _     <- refStatus.set(after)
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  AssemblyEvent.Harvesting(HarvestingEvent.Accepted(member))
                )
              yield ()
            case _ =>
              Sync[F].pure(())
          }
        case MemberEvent.HashNext(msg) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Hashes(hd :: tl)))
                if member === hd && tl.nonEmpty =>
              for
                _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Hashes(tl))))
                _ <- sendMessage(
                  Destination.Selected(Set(tl.head)),
                  AssemblyEvent.Protocol(
                    HarvestProtocol.Event.Hash(
                      Some(msg),
                      tl.tail
                    )
                  )
                )
              yield ()
            case _ =>
              Sync[F].pure(())
          }
        case MemberEvent.Hashes(hs) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Hashes(hd :: Nil))) if hd === member =>
              for
                _ <- refStatus.set(
                  Harvesting(h, Started(HarvestProtocol.Verification(hs, immutable.Map.empty)))
                )
                _ <- sendMessage(
                  Destination.Selected(h.participants),
                  AssemblyEvent.Protocol(HarvestProtocol.Event.Validate(hs))
                )
              yield ()
            case _ =>
              Sync[F].pure(())
          }
        case MemberEvent.Invalid =>
          Sync[F].pure(())
        case MemberEvent.Vallid(sig) =>
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
                    _ <- refStatus.set(
                      Harvesting(h, Started(HarvestProtocol.Reals(hs, sigs, remaining)))
                    )
                    _ <- sendMessage(
                      Destination.Selected(h.participants),
                      AssemblyEvent.Protocol(HarvestProtocol.Event.Validity(newSigs))
                    )
                    _ <- sendMessage(
                      Destination.Selected(Set(remaining.head)),
                      AssemblyEvent.Protocol(HarvestProtocol.Event.Real(None, remaining.tail))
                    )
                  yield ()
                else
                  refStatus.set(Harvesting(h, Started(HarvestProtocol.Verification(hs, newSigs))))
              case _ =>
                Sync[F].pure(())
            }
          }
        case MemberEvent.RealNext(msg) =>
          refStatus.get.flatMap {
            case Harvesting(h, Started(HarvestProtocol.Reals(hs, s, hd :: tl))) =>
              for
                _ <- refStatus.set(Harvesting(h, Started(HarvestProtocol.Reals(hs, s, tl))))
                _ <- sendMessage(
                  Destination.Selected(Set(hd)),
                  AssemblyEvent.Protocol(
                    HarvestProtocol.Event.Real(
                      Some(msg),
                      tl
                    )
                  )
                )
              yield ()
            case _ =>
              Sync[F].pure(())
          }
        case MemberEvent.Reals(r) =>
          Sync[F].pure(())
    }

  private def memberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)(using
      Sync[F]
  ): F[Unit] =
    refStatus.get.flatMap {
      case Waiting(i, q, r) if r.get(member) =!= Some(blocking) =>
        for
          after <- reduceStatus(Waiting(i, q, r + (member -> blocking)))
          _     <- refStatus.set(after)
          _ <- sendMessage(
            Destination.All,
            AssemblyEvent.Public(assembly.Event.MemberBlocking(member, blocking))
          )
        yield ()
      case p @ Harvesting(h, Proposed(r))
          if (blocking: Member.Readiness) === Member.Readiness.Blocking && h.participants.contains(
            member
          ) && r.contains(member) =>
        for
          status <- forcedWaiting(p, Some(member))
          _      <- reduceAndSync(h.participants, status)
          _ <- sendMessage(
            Destination.Selected(h.participants),
            AssemblyEvent.Public(assembly.Event.MemberBlocking(member, blocking))
          )
        yield ()
      case _ =>
        Sync[F].pure(())
    }

  def memberChannel(
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  )(using Sync[F]): F[Unit] =
    mutex.permit.surround {
      for
        _ <- unsafeRemoveMember(member)
        _ <- refChannels.modify(m => (m + (member -> handler), ()))
        _ <- refAbsent.modify(m => (m - member, ()))
        _ <- refStatus.modify {
          case Waiting(i, q, r) =>
            (Waiting(i, q, r + (member -> Member.Readiness.Answering)), ())
          case st =>
            (st, ())
        }
        st <- state(member)
        _  <- sendMessage(Destination.Selected(Set(member)), AssemblyEvent.State(st))
        _ <- sendMessage(
          Destination.Filtered(_ =!= member),
          AssemblyEvent.Public(assembly.Event.MemberPresence(member, Member.Presence.Present))
        )
      yield ()
    }

object Assembly:
  def make[F[_]: Async](
      identityProofStore: IdentityProofStore[F],
      info: assembly.Info
  ): F[Assembly[F]] =
    for
      mutex       <- Semaphore[F](1)
      refChannels <- Ref.of(immutable.Map.empty[Fingerprint, AssemblyEvent => F[Unit]])
      refAbsent   <- Ref.of(immutable.Map.empty[Fingerprint, Instant])
      refQuestons <- Ref.of(List.empty[String])
      status      <- Status.init
      refStatus   <- Ref.of(status)
    yield new Assembly(
      info,
      identityProofStore,
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
