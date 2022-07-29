package chrilves.kuzh.back.services

import scala.collection.*
import cats.effect.kernel.Sync
import cats.syntax.eq.*

import chrilves.kuzh.back.models.IdentityProof
import chrilves.kuzh.back.models.Member

trait IdentityProofStore[F[_]]:
  def store(id: IdentityProof): F[Unit]
  def fetch(ids: Member.Fingerprint): F[Option[IdentityProof]]
  def delete(ids: Member.Fingerprint): F[Unit]

object IdentityProofStore:

  final case class InconsistentIdentityProofs(member: Member.Fingerprint) extends Throwable

  inline def inMemory[F[_]: Sync]: IdentityProofStore[F] =
    new IdentityProofStore[F] {
      val idStore: mutable.Map[Member.Fingerprint, IdentityProof] =
        mutable.Map.empty[Member.Fingerprint, IdentityProof]

      def store(id: IdentityProof): F[Unit] =
        Sync[F].delay {
          idStore.get(id.fingerprint) match
            case Some(id2) =>
              if id =!= id2
              then throw InconsistentIdentityProofs(id.fingerprint)
            case None =>
              idStore.addOne(id.fingerprint -> id)
        }

      def fetch(fp: Member.Fingerprint): F[Option[IdentityProof]] =
        Sync[F].delay {
          idStore.get(fp)
        }

      def delete(fp: Member.Fingerprint): F[Unit] =
        Sync[F].delay {
          idStore.remove(fp)
        }
    }
