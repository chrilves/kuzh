package chrilves.kuzh.back.lib

import java.security.MessageDigest
import java.util.Base64
import java.nio.charset.StandardCharsets
import java.security.interfaces.RSAPublicKey
import cats.effect.Resource
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Signature
import java.security.spec.PSSParameterSpec
import java.security.spec.MGF1ParameterSpec
import cats.Functor
import io.circe.*
import io.circe.syntax._
import cats.kernel.Eq
import cats.effect.kernel.Sync
import com.nimbusds.jose.jwk.JWK
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.models.Member.Fingerprint

object StringInstances:
  inline def encoder: Encoder[String]   = summon[Encoder[String]]
  inline def decoder: Decoder[String]   = summon[Decoder[String]]
  inline def eq: Eq[String]             = summon[Eq[String]]
  inline def ordering: Ordering[String] = summon[Ordering[String]]

object JWKInstances:
  inline given decoderJWK: Decoder[JWK] with
    def apply(c: HCursor): Decoder.Result[JWK] =
      c.as[Json].map { json =>
        JWK.parse(json.noSpaces)
      }

  inline given encoderJWK: Encoder[JWK] with
    def apply(a: JWK): Json =
      io.circe.parser.parse(a.toJSONString()) match {
        case Left(e) => throw e
        case Right(j) =>
          j.deepMerge(Json.obj("ext" -> Json.fromBoolean(true)))
      }

  inline given signableJWK: Signable[JWK] =
    Signable.stringSignable.contraMap { jwk =>
      encoderJWK(jwk).noSpacesSortKeys
    }

  inline given eqJWK: Eq[JWK] with
    def eqv(x: JWK, y: JWK): Boolean =
      x.toJSONString() == y.toJSONString()

  extension (publicKey: JWK)
    inline def fingerprint: Fingerprint =
      Fingerprint.fromString(Base64UrlEncoded.hash(encoderJWK(publicKey).noSpacesSortKeys).asString)

    inline def toRSAPublicKey: RSAPublicKey =
      publicKey.toRSAKey.toRSAPublicKey

object Random:
  def bytes[F[_]: Sync](n: Int): F[Array[Byte]] =
    Sync[F].delay {
      val arr: Array[Byte] = Array.fill[Byte](n)(0x0)
      val rnd              = new java.util.Random
      rnd.nextBytes(arr)
      arr
    }
