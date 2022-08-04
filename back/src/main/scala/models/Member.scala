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
import com.nimbusds.jose.jwk.JWK
import java.security.interfaces.RSAPublicKey
import io.circe.Decoder.Result

object Member:
  opaque type Name        = String
  opaque type VerifyPK    = JWK
  opaque type EncryptPK   = JWK
  opaque type Fingerprint = String

  object Name:
    inline given decoder: Decoder[Name]   = StringInstances.decoder
    inline given encoder: Encoder[Name]   = StringInstances.encoder
    inline given signable: Signable[Name] = Signable.stringSignable
    inline given eq: Eq[Name]             = StringInstances.eq

    extension (n: Name) inline def asString: String = n

  object VerifyPK:
    inline given decoderVerifyPK: Decoder[VerifyPK]   = JWKInstances.decoderJWK
    inline given encoderVerifyPK: Encoder[VerifyPK]   = JWKInstances.encoderJWK
    inline given eqVerifyPK: Eq[VerifyPK]             = JWKInstances.eqJWK
    inline given signableVerifyPK: Signable[VerifyPK] = JWKInstances.signableJWK

    extension (publicKey: VerifyPK)
      inline def fingerprint: Fingerprint =
        JWKInstances.fingerprint(publicKey)

      inline def toRSAPublicKey: RSAPublicKey =
        JWKInstances.toRSAPublicKey(publicKey)

  object EncryptPK:
    inline given decoderEncryptPK: Decoder[EncryptPK]   = JWKInstances.decoderJWK
    inline given encoderEncryptPK: Encoder[EncryptPK]   = JWKInstances.encoderJWK
    inline given eqEncryptPK: Eq[EncryptPK]             = JWKInstances.eqJWK
    inline given signableEncryptPK: Signable[EncryptPK] = JWKInstances.signableJWK

    extension (publicKey: EncryptPK)
      inline def fingerprint: Fingerprint =
        JWKInstances.fingerprint(publicKey)

      inline def toRSAPublicKey: RSAPublicKey =
        JWKInstances.toRSAPublicKey(publicKey)

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

    given Eq[Presence] = Eq.fromUniversalEquals

  sealed abstract class Readiness
  sealed abstract class Blockingness extends Readiness

  object Readiness:
    case object Answering extends Readiness
    case object Blocking  extends Blockingness
    case object Ready     extends Blockingness

    given readinessEncoder: Encoder[Readiness] with
      final def apply(r: Readiness): Json =
        Json.fromString(r match
          case Answering => "answering"
          case Blocking  => "blocking"
          case Ready     => "ready"
        )

    given Eq[Readiness] = Eq.fromUniversalEquals

    given readinessDecoder: Decoder[Readiness] with
      def apply(c: HCursor): Decoder.Result[Readiness] =
        import Decoder.resultInstance.*
        c.as[String].flatMap { (s: String) =>
          s.trim.toLowerCase() match
            case "answering" => pure(Readiness.Answering)
            case "blocking"  => pure(Readiness.Blocking)
            case "ready"     => pure(Readiness.Ready)
            case s =>
              raiseError(
                DecodingFailure(s" '$s' is not a readiness, should be 'busy' or 'ready'.", Nil)
              )
        }

  enum Event:
    case Blocking(blockingness: Blockingness)
    case AcceptHarvest
    case HashNext(message: Base64UrlEncoded)
    case Hashes(hashes: List[Base64UrlEncoded])
    case Invalid
    case Vallid(signature: Signature[HarvestProtocol.Proof])
    case RealNext(message: Base64UrlEncoded)
    case Reals(reals: List[Ballot])

  object Event:
    given memberEventDecoder: Decoder[Event] with
      def apply(c: HCursor): Result[Event] =
        import Decoder.resultInstance.*
        c.downField("tag").as[String].flatMap {
          case "blocking" =>
            c.downField("blocking").as[String].flatMap {
              case "blocking" => pure(Blocking(Member.Readiness.Blocking))
              case "ready"    => pure(Blocking(Member.Readiness.Ready))
              case s =>
                raiseError(
                  DecodingFailure(s"Invalid message from member tag blocking, value '$s'.", Nil)
                )
            }
          case "accept_harvest" =>
            pure(AcceptHarvest)
          case "hash_next" =>
            for hashNext <- c.downField("message").as[String]
            yield HashNext(Base64UrlEncoded.unsafeFromString(hashNext))
          case "hashes" =>
            for l <- c.downField("hashes").as[List[String]]
            yield Hashes(l.sorted.map(Base64UrlEncoded.unsafeFromString(_)))
          case "invalid" =>
            pure(Invalid)
          case "valid" =>
            for v <- c.downField("signature").as[Signature[HarvestProtocol.Proof]]
            yield Vallid(v)
          case "real_next" =>
            for r <- c.downField("message").as[String]
            yield RealNext(Base64UrlEncoded.unsafeFromString(r))
          case "reals" =>
            for r <- c.downField("reals").as[List[Ballot]]
            yield Reals(r)
          case s =>
            raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
        }
