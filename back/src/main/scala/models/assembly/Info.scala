package chrilves.kuzh.back.models.assembly

import cats.*
import cats.effect.*
import cats.implicits.*
import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.*
import io.circe.*
import io.circe.syntax.*
import org.http4s.Header.Single
import org.http4s.*
import org.http4s.circe.*
import org.typelevel.ci.*

/* ASSUMPTIONS:

   Member.Fingerprint => member identity proof registered!
 */

final case class Info(
    id: Info.Id,
    name: Info.Name,
    secret: Info.Secret
)

object Info:
  given Eq[Info] = Eq.fromUniversalEquals

  opaque type Id = java.util.UUID

  object Id:
    inline def random[F[_]: Sync]: F[Id] =
      Sync[F].delay(java.util.UUID.randomUUID())

    inline def fromUUID(id: java.util.UUID): Id =
      id

    inline given Encoder[Id] = lib.StringInstances.encoder.contramap[java.util.UUID](_.toString())
    inline given Decoder[Id] = lib.StringInstances.decoder.map(java.util.UUID.fromString)
    inline given Eq[Secret]  = Eq.fromUniversalEquals

  opaque type Name = String

  object Name:
    given nameEntityDecoder[F[_]: Concurrent]: EntityDecoder[F, Name] =
      jsonOf[F, Name]

    inline given Encoder[Name] = lib.StringInstances.encoder
    inline given Decoder[Name] = lib.StringInstances.decoder
    inline given Eq[Name]      = lib.StringInstances.eq

  opaque type Secret = String

  object Secret:
    given secretHeader: Header[Secret, Single] =
      Header.create(
        ci"X-KUZH-ASSEMBLY-SECRET",
        x => x,
        Right(_)
      )

    inline given Encoder[Secret] = lib.StringInstances.encoder
    inline given Decoder[Secret] = lib.StringInstances.decoder
    inline given Eq[Secret]      = lib.StringInstances.eq

    inline def random[F[_]: Sync]: F[Secret] =
      lib.Random.bytes(32).map { arr =>
        Base64UrlEncoded.encode(arr).asString
      }

  given assemblyInfoEncoder: Encoder[Info] with
    final def apply(i: Info): Json = Json.obj(
      "id"     -> i.id.asJson,
      "name"   -> i.name.asJson,
      "secret" -> i.secret.asJson
    )

  given assemblyInfoDecoder: Decoder[Info] with
    final def apply(h: HCursor): Decoder.Result[Info] =
      import Decoder.resultInstance.*
      for
        id     <- h.downField("id").as[Id]
        name   <- h.downField("name").as[Name]
        secret <- h.downField("secret").as[Secret]
      yield Info(id, name, secret)
