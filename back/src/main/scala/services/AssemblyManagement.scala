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

trait AssemblyManagement[F[_]]:
  def create(name: Assembly.Info.Name): F[Assembly.Info]
  def withAssembly[R](uuid: Assembly.Info.Id, secret: Assembly.Info.Secret)(
      f: Option[Assembly[F]] => F[R]
  ): F[R]

  inline final def name(uuid: Assembly.Info.Id, secret: Assembly.Info.Secret)(using
      Applicative[F]
  ): F[Option[Assembly.Info.Name]] =
    withAssembly(uuid, secret)(x => Applicative[F].pure(x.map(_.info.name)))

object AssemblyManagement:
  inline def apply[F[_]](using ev: AssemblyManagement[F]): ev.type = ev

  def inMemory[F[_]: Sync]: AssemblyManagement[F] =
    new AssemblyManagement[F]:
      val assemblies = mutable.Map.empty[Assembly.Info.Id, Assembly[F]]

      def create(name: Assembly.Info.Name): F[Assembly.Info] =
        for
          id     <- Assembly.Info.Id.random
          secret <- Assembly.Info.Secret.random
          info = Assembly.Info(id, name, secret)
          _ <- Sync[F].delay(
            assemblies.addOne(
              id -> Assembly.inMemory[F](info, Sync[F].delay(assemblies.remove(id)))
            )
          )
        yield info

      def withAssembly[R](uuid: Assembly.Info.Id, secret: Assembly.Info.Secret)(
          f: Option[Assembly[F]] => F[R]
      ): F[R] =
        Sync[F].delay(assemblies.get(uuid).filter(_.info.secret === secret)).flatMap(f)
