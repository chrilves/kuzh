package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*
import cats.syntax.eq.*
import cats.syntax.functor.*
import java.util.*
import chrilves.kuzh.back.lib.crypto.*

enum Handshake:
  case Crententials(id: assembly.Info.Id, secret: assembly.Info.Secret, member: Member.Fingerprint)
  case Challenge(challenge: Array[Byte], identityProofNeeded: Boolean)
  case ChallengeResponse(signature: Signature[Array[Byte]], identityProof: Option[IdentityProof])
  case Error(reason: String, fatal: Boolean)
  case Established

object Handshake:

  extension (cr: ChallengeResponse)
    def check(
        member: Member.Fingerprint,
        storedIdentityProof: Option[IdentityProof],
        challenge: Array[Byte]
    ): Option[IdentityProof] =
      // Validity + Cohenrence
      if (
        cr.identityProof.map(_.isValid).getOrElse(true) &&
        cr.identityProof.flatMap(id1 => storedIdentityProof.map(id2 => id1 === id2)).getOrElse(true)
      )
      then
        storedIdentityProof.orElse(cr.identityProof).flatMap { id =>
          withVerify[Option[IdentityProof]](id.verify.toRSAPublicKey) { f =>
            if f[Array[Byte]](Signed(challenge, cr.signature))
            then Some(id)
            else None
          }
        }
      else None

  given handshakeEncoder: Encoder[Handshake] with
    final def apply(h: Handshake): Json =
      h match
        case Crententials(id, secret, member) =>
          Json.obj(
            "tag"    -> Json.fromString("credentials"),
            "id"     -> id.asJson,
            "secret" -> secret.asJson
          )
        case Challenge(challenge, identityProofNeeded) =>
          Json.obj(
            "tag"                   -> Json.fromString("challenge"),
            "challenge"             -> Json.fromString(Base64UrlEncoded.encode(challenge).asString),
            "identity_proof_needed" -> Json.fromBoolean(identityProofNeeded)
          )
        case ChallengeResponse(signature, identityProof) =>
          Json.obj(
            "tag"            -> Json.fromString("challenge_response"),
            "signature"      -> signature.asJson,
            "identity_proof" -> identityProof.map(_.asJson).getOrElse(Json.Null)
          )
        case Error(reason, fatal) =>
          Json.obj(
            "tag"    -> Json.fromString("error"),
            "reason" -> Json.fromString(reason),
            "fatal"  -> Json.fromBoolean(fatal)
          )
        case Established =>
          Json.obj("tag" -> Json.fromString("established"))

  given handshakeDecoder: Decoder[Handshake] with
    def apply(c: HCursor): Decoder.Result[Handshake] =
      import Decoder.resultInstance.*
      c.downField("tag").as[String].flatMap {
        case "credentials" =>
          for
            id     <- c.downField("id").as[assembly.Info.Id]
            secret <- c.downField("secret").as[assembly.Info.Secret]
            member <- c.downField("member").as[Member.Fingerprint]
          yield Crententials(id, secret, member)
        case "challenge" =>
          for
            challenge <- c.downField("challenge").as[String].map(Base64.getUrlDecoder().decode)
            identityProofNeeded <- c.downField("identity_proof_needed").as[Boolean]
          yield Challenge(challenge, identityProofNeeded)

        case "challenge_response" =>
          for
            sig <- c.downField("signature").as[String].map(Signature.fromString[Array[Byte]](_))
            id  <- c.downField("identity_proof").as[Option[IdentityProof]]
          yield ChallengeResponse(sig, id)

        case "error" =>
          for
            reason <- c.downField("reason").as[String]
            fatal  <- c.downField("fatal").as[Boolean]
          yield Error(reason, fatal)

        case "established" =>
          pure(Established)

        case tag =>
          raiseError(DecodingFailure(s"Unknown handshake tag '${tag}' in ${c}", Nil))
      }
