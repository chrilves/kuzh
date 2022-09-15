package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*
import cats.syntax.eq.*
import cats.syntax.functor.*
import java.util.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.*

object Handshake:
  enum Out:
    case Challenge(challenge: Array[Byte], identityProofNeeded: Boolean)
    case Error(error: String, fatal: Boolean)
    case Established(state: State[Any])

  object Out:
    given handshakeEncoder: Encoder[Handshake.Out] with
      final def apply(h: Handshake.Out): Json =
        h match
          case Challenge(challenge, identityProofNeeded) =>
            Json.obj(
              "tag"                   -> "challenge".asJson,
              "challenge"             -> Base64UrlEncoded.encode(challenge).asString.asJson,
              "identity_proof_needed" -> identityProofNeeded.asJson
            )
          case Error(error, fatal) =>
            Json.obj(
              "tag"   -> "error".asJson,
              "error" -> error.asJson,
              "fatal" -> fatal.asJson
            )
          case Established(state) =>
            Json.obj("tag" -> "established".asJson, "state" -> state.asJson)

  enum In:
    case Crententials(assembly: models.assembly.Info, member: Member.Fingerprint)
    case ChallengeResponse(signature: Signature[Array[Byte]], identityProof: Option[IdentityProof])

  object In:
    extension (cr: ChallengeResponse)
      def check(
          member: Member.Fingerprint,
          storedIdentityProof: Option[IdentityProof],
          challenge: Array[Byte]
      ): Option[IdentityProof] =
        // Validity + Cohenrence
        if (
          cr.identityProof.map(_.isValid).getOrElse(true) &&
          cr.identityProof
            .flatMap(id1 => storedIdentityProof.map(id2 => id1 === id2))
            .getOrElse(true)
        )
        then
          storedIdentityProof.orElse(cr.identityProof).flatMap { id =>
            withVerify[Option[IdentityProof]](id.verify.toECPublicKey) { f =>
              if f[Array[Byte]](Signed(challenge, cr.signature))
              then Some(id)
              else None
            }
          }
        else None

    given handshakeDecoder: Decoder[Handshake.In] with
      def apply(c: HCursor): Decoder.Result[Handshake.In] =
        import Decoder.resultInstance.*
        c.downField("tag").as[String].flatMap {
          case "credentials" =>
            for
              assembly <- c.downField("assembly").as[assembly.Info]
              member   <- c.downField("member").as[Member.Fingerprint]
            yield Crententials(assembly, member)

          case "challenge_response" =>
            for
              sig <- c.downField("signature").as[Signature[Array[Byte]]]
              id  <- c.downField("identity_proof").as[Option[IdentityProof]]
            yield ChallengeResponse(sig, id)

          case tag =>
            raiseError(DecodingFailure(s"Unknown handshake tag '${tag}' in ${c}", Nil))
        }
