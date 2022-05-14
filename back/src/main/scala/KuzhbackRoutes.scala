package chrilves.kuzhback

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
import chrilves.kuzhback.middleware.*

object KuzhbackRoutes:
  def assemblyPost[F[_]: Async](assembly: AssemblyAPI[F]): HttpRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    HttpRoutes.of[F] {
      case request @ POST -> Root / "assembly" =>
        for
          name <- request.as[Assembly.Name]
          info <- assembly.create(name)
          resp <- Ok(info.asJson)
        yield resp
    }

  def assemblyRoutes[F[_]: Async](assembly: AssemblyAPI[F]): AssemblyRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    AssemblyRoutes.of[F] {
      case AssemblyRequest(i, GET -> Root / "name") =>
        Ok(i.name.asJson)
        
      case AssemblyRequest(i, GET -> Root / "keys") =>
        Ok(i.name.asJson)

      case AssemblyRequest(i, GET -> Root / "keys" / fingerprint) =>
        Ok(i.name.asJson)
    }