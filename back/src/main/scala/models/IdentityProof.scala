package chrilves.kuzh.back.models

import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.*
import com.nimbusds.jose.jwk.JWK
import cats.kernel.Eq
import cats.syntax.eq._
import java.security.interfaces.RSAPublicKey
import io.circe.Encoder
import io.circe.Json
import io.circe.syntax.*
import io.circe.Decoder
import io.circe.HCursor

final case class IdentityProof(
    verify: Member.VerifyPK,
    fingerprint: Member.Fingerprint,
    encrypt: Signed[Member.EncryptPK],
    nickname: Signed[Member.Name]
) {

  def verifyKey: RSAPublicKey =
    JWK.parse(verify.asString).toRSAKey.toRSAPublicKey

  def encryptKey: RSAPublicKey =
    JWK.parse(encrypt.value.asString).toRSAKey.toRSAPublicKey

  def isValid: Boolean =
    val (encryptOk, nicknameOk) =
      lib.crypto.withVerify(verifyKey) { (verify) =>
        (verify[Member.EncryptPK](encrypt), verify[Member.Name](nickname))
      }

    (fingerprint === Member.VerifyPK.fingerprint(verify)) && encryptOk && nicknameOk
}

object IdentityProof:
  given identityProofEq: Eq[IdentityProof] with
    def eqv(x: IdentityProof, y: IdentityProof): Boolean =
      x.verify === y.verify && x.fingerprint === y.fingerprint && x.encrypt === y.encrypt && x.nickname === y.nickname

  given identityProofEncoder: Encoder[IdentityProof] with
    final def apply(ip: IdentityProof): Json =
      Json.obj(
        "verify"      -> ip.verify.asJson,
        "fingerprint" -> ip.verify.asJson,
        "encrypt"     -> ip.encrypt.asJson,
        "nickname"    -> ip.nickname.asJson
      )

  given handshakeDecoder: Decoder[IdentityProof] with
    def apply(c: HCursor): Decoder.Result[IdentityProof] =
      for
        verify      <- c.downField("verify").as[Member.VerifyPK]
        fingerprint <- c.downField("fingerprint").as[Member.Fingerprint]
        encrypt     <- c.downField("encrypt").as[Signed[Member.EncryptPK]]
        nickname    <- c.downField("nickname").as[Signed[Member.Name]]
      yield IdentityProof(verify, fingerprint, encrypt, nickname)

final case class Secret[A](parcel: A, random: String)

object Secret:
  type Hash = String

  given secretEncoder[A: Encoder]: Encoder[Secret[A]] with
    final def apply(s: Secret[A]): Json =
      Json.obj(
        "parcel" -> s.parcel.asJson,
        "random" -> Json.fromString(s.random)
      )