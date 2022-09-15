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
    dhPublic: Signed[Member.DHPK],
    nickname: Signed[Member.Name]
) {

  def isValid: Boolean =

    val (dhOk, nicknameOk) =
      lib.crypto.withVerify(verify.toECPublicKey) { (verify) =>
        try {
          (verify[Member.DHPK](dhPublic), verify[Member.Name](nickname))
        } catch {
          case e: Throwable =>
            e.printStackTrace()
            throw e
        }
      }

    val fingerprintOk = fingerprint === Member.VerifyPK.fingerprint(verify)
    fingerprintOk && dhOk && nicknameOk
}

object IdentityProof:
  given identityProofEq: Eq[IdentityProof] with
    def eqv(x: IdentityProof, y: IdentityProof): Boolean =
      x.verify === y.verify && x.fingerprint === y.fingerprint && x.dhPublic === y.dhPublic && x.nickname === y.nickname

  given identityProofEncoder: Encoder[IdentityProof] with
    final def apply(ip: IdentityProof): Json =
      Json.obj(
        "verify"      -> ip.verify.asJson,
        "fingerprint" -> ip.fingerprint.asJson,
        "dhPublic"    -> ip.dhPublic.asJson,
        "nickname"    -> ip.nickname.asJson
      )

  given handshakeDecoder: Decoder[IdentityProof] with
    def apply(c: HCursor): Decoder.Result[IdentityProof] =
      for
        verify      <- c.downField("verify").as[Member.VerifyPK]
        fingerprint <- c.downField("fingerprint").as[Member.Fingerprint]
        encrypt     <- c.downField("dhPublic").as[Signed[Member.DHPK]]
        nickname    <- c.downField("nickname").as[Signed[Member.Name]]
      yield IdentityProof(verify, fingerprint, encrypt, nickname)
