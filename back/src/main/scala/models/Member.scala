package chrilves.kuzh.back.models

import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.*
import chrilves.kuzh.back.lib.crypto.*
import cats.*
import io.circe.*
import io.circe.generic.auto.*
import io.circe.syntax.*
import java.time.Instant
import scala.collection.*
import cats.instances.StringInstances

object Member:
  opaque type Name        = String
  opaque type VerifyPK    = String
  opaque type EncryptPK   = String
  opaque type Fingerprint = String

  object Name:
    inline given decoder: Decoder[Name]   = StringInstances.decoder
    inline given encoder: Encoder[Name]   = StringInstances.encoder
    inline given signable: Signable[Name] = Signable.stringSignable
    inline given eq: Eq[Name]             = StringInstances.eq

    extension (n: Name) inline def asString: String = n

  object VerifyPK:
    inline given decoder: Decoder[VerifyPK]   = StringInstances.decoder
    inline given encoder: Encoder[VerifyPK]   = StringInstances.encoder
    inline given signable: Signable[VerifyPK] = Signable.stringSignable
    inline given eq: Eq[VerifyPK]             = StringInstances.eq

    extension (pk: VerifyPK)
      inline def asString: String =
        pk

    extension (publicKey: VerifyPK)
      inline def fingerprint: Fingerprint =
        Base64UrlEncoded.hash(publicKey).asString

  object EncryptPK:
    inline given decoder: Decoder[EncryptPK]   = StringInstances.decoder
    inline given encoder: Encoder[EncryptPK]   = StringInstances.encoder
    inline given signable: Signable[EncryptPK] = Signable.stringSignable
    inline given eq: Eq[EncryptPK]             = StringInstances.eq

    extension (pk: EncryptPK) inline def asString: String = pk

  object Fingerprint:
    inline given decoder: Decoder[Fingerprint]   = StringInstances.decoder
    inline given encoder: Encoder[Fingerprint]   = StringInstances.encoder
    inline given signable: Signable[Fingerprint] = Signable.stringSignable
    inline given eq: Eq[Fingerprint]             = StringInstances.eq
    inline given ordering: Ordering[Fingerprint] = StringInstances.ordering

    inline def fromString(str: String): Fingerprint = str

  enum Presence:
    case Absent(since: Instant)
    case Present

  object Presence:
    given presenceEncoder: Encoder[Presence] with
      final def apply(p: Presence): Json =
        p match
          case Absent(i) =>
            Json.obj(
              "tag"   -> Json.fromString("absent"),
              "since" -> Json.fromLong(i.toEpochMilli())
            )
          case Present =>
            Json.obj(
              "tag" -> Json.fromString("present")
            )

  enum Readiness:
    case Busy, Ready

  object Readiness:
    given readinessEncoder: Encoder[Readiness] with
      final def apply(r: Readiness): Json =
        Json.fromString(r match
          case Busy  => "busy"
          case Ready => "ready"
        )

    given readinessDecoder: Decoder[Readiness] with
      def apply(c: HCursor): Decoder.Result[Readiness] =
        import Decoder.resultInstance.*
        c.as[String].flatMap { (s: String) =>
          s.trim.toLowerCase() match
            case "busy"  => pure(Readiness.Busy)
            case "ready" => pure(Readiness.Ready)
            case s =>
              raiseError(
                DecodingFailure(s" '$s' is not a readiness, should be 'busy' or 'ready'.", Nil)
              )
        }
