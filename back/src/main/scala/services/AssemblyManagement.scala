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

  def register(info: assembly.Info): F[Unit]

  def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
      f: Option[Assembly[F]] => F[R]
  ): F[R]

  final def withAssemblyInfo[R](info: assembly.Info)(f: Assembly[F] => F[R])(using Monad[F]): F[R] =
    withAssembly(info.id, info.secret) {
      case Some(asm) => f(asm)
      case None      => register(info) *> withAssemblyInfo(info)(f)
    }

  inline final def name(id: assembly.Info.Id, secret: assembly.Info.Secret)(using
      Applicative[F]
  ): F[Option[assembly.Info.Name]] =
    withAssembly(id, secret)(x => Applicative[F].pure(x.map(_.info.name)))

object AssemblyManagement:
  inline def apply[F[_]](using ev: AssemblyManagement[F]): ev.type = ev

  def inMemory[F[_]: Async]: AssemblyManagement[F] =
    new AssemblyManagement[F]:
      val assemblies = mutable.Map.empty[assembly.Info.Id, Assembly[F]]

      def register(info: assembly.Info): F[Unit] =
        Sync[F].delay(assemblies.get(info.id)).flatMap { (asmOpt: Option[Assembly[F]]) =>
          val ok = asmOpt match
            case Some(asm) => asm.info === info
            case _         => true

          if (ok)
          then
            for
              asm <- Assembly
                .make(
                  IdentityProofStore.inMemory,
                  info,
                  Sync[F].delay {
                    println(s"Closing assembly ${info.id}")
                    assemblies.remove(info.id)
                  }
                )
              _ <- Sync[F].delay(
                assemblies.addOne(info.id -> asm)
              )
            yield ()
          else Async[F].raiseError(new Exception("Trying to register another assembly!"))
        }

      def create(name: assembly.Info.Name): F[assembly.Info] =
        for
          id     <- assembly.Info.Id.random
          secret <- assembly.Info.Secret.random
          info = assembly.Info(id, name, secret)
          _ <- register(info)
        yield info

      def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
          f: Option[Assembly[F]] => F[R]
      ): F[R] =
        Sync[F].delay(assemblies.get(id).filter(_.info.secret === secret)).flatMap(f)
