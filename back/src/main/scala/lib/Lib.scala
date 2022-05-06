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
import cats.syntax.eq.*
import com.nimbusds.jose.jwk.JWK
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.models.Member.Fingerprint
import scala.annotation.tailrec
import cats.syntax.all.*
import java.time.Instant

object StringInstances:
  inline def encoder: Encoder[String]   = summon[Encoder[String]]
  inline def decoder: Decoder[String]   = summon[Decoder[String]]
  inline def eq: Eq[String]             = summon[Eq[String]]
  inline def ordering: Ordering[String] = summon[Ordering[String]]

object ArrayByteInstances:
  inline def encoder: Encoder[Array[Byte]] =
    new Encoder[Array[Byte]]:
      def apply(a: Array[Byte]): Json =
        Json.fromString(Base64UrlEncoded.encode(a).asString)

  inline def decoder: Decoder[Array[Byte]] =
    new Decoder[Array[Byte]]:
      def apply(c: HCursor): Decoder.Result[Array[Byte]] =
        c.as[String].map { s =>
          Base64.getUrlDecoder().decode(s)
        }

  inline def eq: Eq[Array[Byte]] =
    Eq.fromUniversalEquals

  inline def ordering: Ordering[Array[Byte]] =
    new Ordering[Array[Byte]]:
      @tailrec
      def compare(x: Array[Byte], y: Array[Byte]): Int =
        for i <- 0 to (math.min(x.size, y.size) - 1)
        do
          val n = Ordering[Byte].compare(x(i), y(i))
          if (n =!= 0)
            return n
        Ordering[Int].compare(x.size, y.size)

  object implicits:
    inline given encoder: Encoder[Array[Byte]]   = ArrayByteInstances.encoder
    inline given decoder: Decoder[Array[Byte]]   = ArrayByteInstances.decoder
    inline given ordering: Ordering[Array[Byte]] = ArrayByteInstances.ordering
    inline given eq: Eq[Array[Byte]]             = Eq.fromUniversalEquals

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
      Fingerprint.fromString(
        Base64UrlEncoded.hashB64(encoderJWK(publicKey).noSpacesSortKeys).asString
      )

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

def log[F[_]: Sync](color: String)(s: String): F[Unit] =
  Sync[F].delay(
    println(s"${color}[${java.time.Instant.now()}] ${s}${Console.RESET}\n")
  )

def chrono[F[_]: Sync, A](name: String)(f: => F[A]): F[A] =
  for
    start <- Sync[F].realTimeInstant
    a     <- f
    end   <- Sync[F].realTimeInstant
    _ <- Sync[F].delay(
      println(
        s"${Console.RED}[${start}] ${name}: ${start
            .until(end, java.time.temporal.ChronoUnit.MILLIS)} millis${Console.RESET}"
      )
    )
  yield a

def chronoEnd[F[_]: Sync, A](name: String)(start: Instant): F[Unit] =
  for
    end <- Sync[F].realTimeInstant
    _ <- Sync[F].delay(
      println(
        s"${Console.GREEN}[${start} -> ${end}] ${name}: ${start.until(end, java.time.temporal.ChronoUnit.MILLIS)} millis"
      )
    )
  yield ()

extension [A: Ordering](l: List[A])
  @tailrec def isSorted: Boolean =
    import math.Ordering.Implicits.infixOrderingOps
    l match
      case Nil              => true
      case hd :: Nil        => true
      case hd1 :: hd2 :: tl => (hd1 <= hd2) && (hd2 :: tl).isSorted
