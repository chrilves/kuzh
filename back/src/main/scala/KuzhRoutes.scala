package chrilves.kuzh.back

import cats.effect.*
import cats.implicits.*
import org.http4s.*
import org.http4s.dsl.Http4sDsl
import io.circe.syntax.*
import org.http4s.circe.CirceEntityCodec.*
import cats.data.*
import java.nio.charset.StandardCharsets
import cats.*
import org.http4s.server.websocket.WebSocketBuilder2
import org.http4s.websocket.WebSocketFrame
import java.time.Instant
import cats.effect.std.Queue
import io.circe.Json

import chrilves.kuzh.back.middleware.*
import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.services.*

object KuzhRoutes:
  def assemblyPost[F[_]: Async](
      assemblies: AssemblyManagement[F],
      webSocketBuilder: WebSocketBuilder2[F]
  ): HttpRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    HttpRoutes.of[F] {
      case request @ POST -> Root / "assembly" =>
        for
          name <- request.as[assembly.Info.Name]
          info <- assemblies.create(name)
          resp <- Ok(info.asJson)
        yield resp

      case request @ GET -> Root / "connect" =>
        Connection
          .connect[F](assemblies)
          .flatMap { c =>
            webSocketBuilder
              .withOnClose(c.onClose)
              .withFilterPingPongs(true)
              .build(c.send, c.receive)
          }
    }

  def assemblyRoutes[F[_]: Async]: AssemblyRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    AssemblyRoutes.of[F] {
      case AssemblyRequest(i, request @ POST -> Root / "member") =>
        (for
          identityProof <- request.as[IdentityProof]
          resp          <- Ok(identityProof.isValid.toString)
        yield resp).handleErrorWith(e => BadRequest(e.getMessage()))

      case AssemblyRequest(asm, request @ GET -> Root / "name") =>
        Ok(asm.info.name.asJson)

      case AssemblyRequest(asm, request @ GET -> Root / "identity_proofs") =>
        (for
          fingerprints <- request.as[List[Member.Fingerprint]]
          ids <- fingerprints
            .traverse[F, Option[IdentityProof]](asm.identityProof)
            .map(_.traverse[Option, IdentityProof](x => x))
          resp <- ids match
            case Some(l) => Ok(Json.fromValues(l.map(_.asJson)))
            case _       => NotFound()
        yield resp).handleErrorWith(e => BadRequest(e.getMessage()))
    }
