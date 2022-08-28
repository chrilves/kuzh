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

import chrilves.kuzh.back.models
import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.models.Member
import cats.effect.std.Semaphore

trait AssemblyManagement[F[_]]:
  def create(name: assembly.Info.Name): F[assembly.Info]

  def register(info: assembly.Info): F[Assembly[F]]

  def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
      f: AssemblyManagement.WithAssemblyResult[F] => F[R]
  ): F[R]

  final def withAssemblyInfo[R](info: assembly.Info)(f: Option[Assembly[F]] => F[R])(using
      Monad[F]
  ): F[R] =
    import AssemblyManagement.WithAssemblyResult.*
    withAssembly(info.id, info.secret) {
      case Assembly(asm) => f(Some(asm))
      case NotFound()    => register(info).flatMap(asm => f(Some(asm)))
      case Forbidden()   => f(None)
    }

  inline final def name(id: assembly.Info.Id, secret: assembly.Info.Secret)(using
      Applicative[F]
  ): F[Option[assembly.Info.Name]] =
    import AssemblyManagement.WithAssemblyResult.*
    withAssembly(id, secret) {
      case Assembly(asm) => Applicative[F].pure(Some(asm.info.name))
      case NotFound()    => Applicative[F].pure(None)
      case Forbidden()   => Applicative[F].pure(None)
    }

object AssemblyManagement:
  inline def apply[F[_]](using ev: AssemblyManagement[F]): ev.type = ev

  enum WithAssemblyResult[F[_]]:
    case Assembly(assembly: models.Assembly[F])
    case NotFound[F[_]]()  extends WithAssemblyResult[F]
    case Forbidden[F[_]]() extends WithAssemblyResult[F]

  def inMemory[F[_]: Async]: AssemblyManagement[F] =
    new AssemblyManagement[F]:
      val assemblies = mutable.Map.empty[assembly.Info.Id, Assembly[F]]

      def register(info: assembly.Info): F[Assembly[F]] =
        Async[F].delay(assemblies.get(info.id)).flatMap {
          case Some(asm) =>
            if asm.info === info
            then Async[F].pure(asm)
            else Async[F].raiseError(new Exception("Trying to register another assembly!"))
          case None =>
            for
              asm <- Assembly
                .make(
                  IdentityProofStore.inMemory,
                  info,
                  Async[F].delay {
                    println(s"Closing assembly ${info.id}")
                    assemblies.remove(info.id)
                  }
                )
              _ <- Async[F].delay(
                assemblies.addOne(info.id -> asm)
              )
            yield asm
        }

      def create(name: assembly.Info.Name): F[assembly.Info] =
        import scala.concurrent.duration.*
        for
          id     <- assembly.Info.Id.random
          secret <- assembly.Info.Secret.random
          info = assembly.Info(id, name, secret)
          asm <- register(info)
          _   <- Async[F].start(Async[F].delayBy(asm.closeIfEmpty, 60.seconds))
        yield info

      def withAssembly[R](id: assembly.Info.Id, secret: assembly.Info.Secret)(
          f: WithAssemblyResult[F] => F[R]
      ): F[R] =
        import AssemblyManagement.WithAssemblyResult.*
        Async[F].delay(assemblies.get(id)).flatMap {
          case Some(asm) if asm.info.secret === secret => f(Assembly(asm))
          case Some(_)                                 => f(Forbidden())
          case None                                    => f(NotFound())
        }
