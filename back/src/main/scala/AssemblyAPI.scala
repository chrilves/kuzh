package chrilves.kuzhback

import cats.*
import cats.implicits.*
import cats.effect.*
import org.http4s.*
import org.http4s.dsl.io.*
import org.http4s.implicits.*
import org.http4s.circe.*
import org.http4s.circe.CirceEntityCodec.*
import io.circe.*
import io.circe.generic.auto.*
import io.circe.syntax.*
import java.util.{UUID, Base64}
import java.nio.charset.StandardCharsets
import org.typelevel.ci.*
import org.http4s.Header
import org.http4s.Header.Single
import scala.collection.*
import chrilves.kuzhback.models.Member

trait AssemblyAPI[F[_]] { self =>
  def create(name: Assembly.Name): F[Assembly.Info]

  def name(uuid: Assembly.Id, secret: Assembly.Secret): F[Option[Assembly.Info]]

  def upsertMember(assembly: Assembly.Id, name: Member.Name, publicKey: Member.PK): F[Unit]

  def publicKeys(assembly: Assembly.Id, members: Set[Member.Fingerprint]): F[Map[Member.Fingerprint, Member.PK]]

  def members(assembly: Assembly.Id): F[Map[Member.Fingerprint, Member.Info]]

  def questions(assembly: Assembly.Id): F[List[String]]

  inline final def nt[G[_]](f: F ~> G): AssemblyAPI[G] =
    new AssemblyAPI[G]:
      def create(name: Assembly.Name): G[Assembly.Info] = f(self.create(name))

      def name(uuid: Assembly.Id, secret: Assembly.Secret): G[Option[Assembly.Info]] =
        f(self.name(uuid, secret))

      def upsertMember(assembly: Assembly.Id, name: Member.Name, publicKey: Member.PK): G[Unit] =
        f(self.upsertMember(assembly, name, publicKey))

      def publicKeys(assembly: Assembly.Id, members: Set[Member.Fingerprint]): G[Map[Member.Fingerprint, Member.PK]] =
        f(self.publicKeys(assembly, members))

      def members(assembly: Assembly.Id): G[Map[Member.Fingerprint, Member.Info]] =
        f(self.members(assembly))

      def questions(assembly: Assembly.Id): G[List[String]] =
        f(self.questions(assembly))
}

object AssemblyAPI:
  inline def apply[F[_]](using ev: AssemblyAPI[F]): ev.type = ev

  def memory: AssemblyAPI[IO] =
    new AssemblyAPI[IO]:
        final case class AssemblyStorage(
          info: Assembly.Info,
          publicKeys: mutable.Map[Member.Fingerprint, Member.PK],
          members: mutable.Map[Member.Fingerprint, Member.Info],
          var questions: List[String]
        )

        object AssemblyStorage:
          inline def init(i: Assembly.Info): AssemblyStorage =
            AssemblyStorage(i,mutable.Map.empty,mutable.Map.empty, Nil)

        val assemblies = mutable.Map.empty[Assembly.Id, AssemblyStorage]

        def create(name: Assembly.Name): IO[Assembly.Info] =
          for
            id <- Assembly.Id.random
            secret <- Assembly.Secret.random
            info = Assembly.Info(id, name, secret)
            _ <- IO(assemblies.addOne(id -> AssemblyStorage.init(info)))
          yield info

        def name(id: Assembly.Id, secret: Assembly.Secret): IO[Option[Assembly.Info]] =
          IO {
            assemblies.get(id) match
              case Some(s) if s.info.secret == secret => Some(s.info)
              case _ => None
          }

        def upsertMember(assembly: Assembly.Id, name: Member.Name, publicKey: Member.PK): IO[Unit] =
          IO {
            assemblies.get(assembly) match
              case Some(storage) =>
                val fingerprint = Member.fingerprint(publicKey)
                storage.publicKeys.addOne(fingerprint -> publicKey)
                val newInfo = storage.members.get(fingerprint) match
                  case Some(i) => i.copy(name = name)
                  case _ => Member.Info(name, 0, Member.Presence.Absent)
                storage.members.addOne(fingerprint -> newInfo)
              case _ =>
                throw new Exception("No such assembly")
          }

        def publicKeys(assembly: Assembly.Id, members: Set[Member.Fingerprint]): IO[Map[Member.Fingerprint,Member.PK]] =
          IO {
            assemblies.get(assembly) match
              case Some(storage) =>
                storage.publicKeys.filterKeys(members.contains).toMap
              case _ =>
                throw new Exception("No such assembly")
          }

        def members(assembly: Assembly.Id): IO[Map[Member.Fingerprint, Member.Info]] =
          IO {
            assemblies.get(assembly) match
              case Some(storage) =>
                storage.members.toMap
              case _ =>
                throw new Exception("No such assembly")
          }

        def questions(assembly: Assembly.Id): IO[List[String]] =
          IO {
            assemblies.get(assembly) match
              case Some(storage) =>
                storage.questions
              case _ =>
                throw new Exception("No such assembly")
          }
