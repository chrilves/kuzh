package chrilves.kuzhback

import cats.effect.Async
import cats.implicits.*
import org.http4s.HttpRoutes
import org.http4s.dsl.Http4sDsl
import io.circe.syntax.*
import org.http4s.circe.CirceEntityCodec.*

object KuzhbackRoutes:
  def assemblyRoutes[F[_]: Async](assembly: Assembly[F]): HttpRoutes[F] =
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
