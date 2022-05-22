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

object StringInstances:
  inline def encoder: Encoder[String]   = summon[Encoder[String]]
  inline def decoder: Decoder[String]   = summon[Decoder[String]]
  inline def eq: Eq[String]             = summon[Eq[String]]
  inline def ordering: Ordering[String] = summon[Ordering[String]]

object Random:
  def bytes[F[_]: Sync](n: Int): F[Array[Byte]] =
    Sync[F].delay {
      val arr: Array[Byte] = Array.fill[Byte](n)(0x0)
      val rnd              = new java.util.Random
      rnd.nextBytes(arr)
      arr
    }
