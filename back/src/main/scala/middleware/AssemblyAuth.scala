package chrilves.kuzh.back.middleware

import cats.effect.Async
import cats.implicits.*
import org.http4s.*
import org.http4s.dsl.Http4sDsl
import io.circe.syntax.*
import org.http4s.circe.CirceEntityCodec.*
import io.circe.generic.auto.*
import cats.data.*
import java.nio.charset.StandardCharsets
import cats.*

import chrilves.kuzh.back.*
import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.services.*

final case class AssemblyRequest[F[_]](assembly: Assembly[F], request: Request[F])

type AssemblyRoutes[F[_]] = Kleisli[OptionT[F, _], AssemblyRequest[F], Response[F]]

object AssemblyRoutes:
  def apply[F[_]](run: AssemblyRequest[F] => OptionT[F, Response[F]])(using
      F: Monad[F]
  ): AssemblyRoutes[F] =
    Kleisli(req => OptionT(F.unit >> run(req).value))

  def of[F[_]](pf: PartialFunction[AssemblyRequest[F], F[Response[F]]])(using
      FA: Monad[F]
  ): AssemblyRoutes[F] =
    Kleisli(req => OptionT(FA.unit >> pf.lift(req).sequence))

  def empty[F[_]: Applicative]: AssemblyRoutes[F] =
    Kleisli.liftF(OptionT.none)

def AssemblyAuth[F[_]: Monad](
    assembies: AssemblyManagement[F]
)(f: AssemblyRoutes[F]): HttpRoutes[F] =
  Kleisli[OptionT[F, _], Request[F], Response[F]]((request: Request[F]) =>
    val dsl = new Http4sDsl[F] {}
    import dsl._

    val path     = request.pathInfo
    val segments = path.segments

    if segments.size >= 2 && segments(0).decoded(StandardCharsets.UTF_8) == "assembly"
    then
      try
        val id =
          Assembly.Info.Id.fromUUID(
            java.util.UUID.fromString(segments(1).decoded(StandardCharsets.UTF_8))
          )
        val (_, rest) = path.splitAt(2)
        request.headers.get[Assembly.Info.Secret] match
          case Some(secret) =>
            OptionT(assembies.withAssembly(id, secret) {
              case Some(asm) =>
                f(AssemblyRequest[F](asm, request.withPathInfo(rest))).value
              case _ => Forbidden().map(Some(_))
            })
          case None =>
            OptionT(Forbidden().map(Some(_)))
      catch
        case e: Throwable =>
          OptionT(Monad[F].pure(None))
    else OptionT(Monad[F].pure(None))
  )
