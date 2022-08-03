package chrilves.kuzh.back.services

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
import fs2.Pipe
import org.http4s.websocket.WebSocketFrame
import scala.collection.*
import cats.syntax.eq.*

import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.models.Member
import cats.effect.std.Semaphore

trait AssemblyManagement[F[_]]:
  def create(name: assembly.Info.Name): F[assembly.Info]
  def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
      f: Option[Assembly[F]] => F[R]
  ): F[R]

  inline final def name(id: assembly.Info.Id, secret: assembly.Info.Secret)(using
      Applicative[F]
  ): F[Option[assembly.Info.Name]] =
    withAssembly(id, secret)(x => Applicative[F].pure(x.map(_.info.name)))

object AssemblyManagement:
  inline def apply[F[_]](using ev: AssemblyManagement[F]): ev.type = ev

  def inMemory[F[_]: Async]: AssemblyManagement[F] =
    new AssemblyManagement[F]:
      val assemblies = mutable.Map.empty[assembly.Info.Id, Assembly[F]]

      def create(name: assembly.Info.Name): F[assembly.Info] =
        for
          id     <- assembly.Info.Id.random
          secret <- assembly.Info.Secret.random
          info = assembly.Info(id, name, secret)
          asm <- Assembly.make(IdentityProofStore.inMemory, info)
          _ <- Sync[F].delay(
            assemblies.addOne(id -> asm)
          )
        yield info

      def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
          f: Option[Assembly[F]] => F[R]
      ): F[R] =
        Sync[F].delay(assemblies.get(id).filter(_.info.secret === secret)).flatMap(f)
