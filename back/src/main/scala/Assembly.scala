package chrilves.kuzhback

import cats.Applicative
import cats.Monad
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


object Assembly:
  final case class Id(id: java.util.UUID)

  object Id:
    inline def random: IO[Id] = IO(Id(java.util.UUID.randomUUID()))

  final case class Name(name: String)

  object Name:
    given nameEntityDecoder[F[_]: Concurrent]: EntityDecoder[F, Name] =
      jsonOf[F, Name]

  final case class Secret(secret: String)

  object Secret:
    given secretHeader: Header[Secret, Single] =
      Header.create(
        ci"X-KUZH-ASSEMBLY-SECRET",
        _.secret,
        s => Right(Secret(s))
      )

    inline def random: IO[Secret] =
      IO {
        val arr: Array[Byte] = Array.fill[Byte](32)(0x0)
        val rnd              = new java.util.Random
        rnd.nextBytes(arr)
        Secret(new String(Base64.getUrlEncoder.encode(arr), StandardCharsets.UTF_8))
      }

  final case class Info(
    id: Id,
    name: Name,
    secret: Secret
  )

  object Info:
    given infoEncoder: Encoder[Info] =
      new Encoder[Info]:
        final def apply(i: Info): Json = Json.obj(
          ("uuid", Json.fromString(i.id.id.toString())),
          ("name", Json.fromString(i.name.name)),
          ("secret", Json.fromString(i.secret.secret))
        )