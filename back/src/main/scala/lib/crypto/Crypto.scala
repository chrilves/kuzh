package chrilves.kuzh.back.lib.crypto

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
import chrilves.kuzh.back.lib.*
import cats.kernel.Eq
import cats.syntax.eq.*

opaque type Base64UrlEncoded = String
object Base64UrlEncoded:
  def unsafeFromString(s: String): Base64UrlEncoded = s

  inline def encode(arr: Array[Byte]): Base64UrlEncoded =
    new String(Base64.getUrlEncoder.encode(arr), StandardCharsets.UTF_8)

  extension (b: Base64UrlEncoded)
    inline def decode: Array[Byte] =
      Base64.getUrlDecoder().decode(b)
    inline def asString: String =
      b

  def hash(msg: String): Array[Byte] =
    val md = MessageDigest.getInstance("SHA-256")
    md.update(msg.getBytes(StandardCharsets.UTF_8))
    md.digest()

  inline def hashB64(msg: String): Base64UrlEncoded =
    Base64UrlEncoded.encode(hash(msg))

  inline def hashJSON[A: Encoder](a: A): Base64UrlEncoded =
    hashB64(a.asJson.noSpacesSortKeys)

  given Signable[Base64UrlEncoded] with
    def apply(a: String): Array[Byte] =
      Base64.getUrlDecoder.decode(a)

  inline given [A]: Encoder[Base64UrlEncoded]  = StringInstances.encoder
  inline given [A]: Decoder[Base64UrlEncoded]  = StringInstances.decoder
  inline given [A]: Eq[Base64UrlEncoded]       = StringInstances.eq
  inline given [A]: Ordering[Base64UrlEncoded] = StringInstances.ordering

opaque type Signature[+A] = String
object Signature:
  inline def fromString[A](str: Base64UrlEncoded): Signature[A] = str

  inline given [A]: Encoder[Signature[A]]  = StringInstances.encoder
  inline given [A]: Decoder[Signature[A]]  = StringInstances.decoder
  inline given [A]: Eq[Signature[A]]       = StringInstances.eq
  inline given [A]: Ordering[Signature[A]] = StringInstances.ordering

  extension [A](b: Signature[A])
    inline def decode: Array[Byte] =
      Base64.getUrlDecoder().decode(b)
    inline def asString: String =
      b

final case class Signed[+A](
    value: A,
    signature: Signature[A]
)

object Signed:
  given signedDecoder[A: Decoder]: Decoder[Signed[A]] with
    def apply(c: HCursor): Decoder.Result[Signed[A]] =
      for
        value     <- c.downField("value").as[A]
        signature <- c.downField("signature").as[Signature[A]]
      yield Signed(value, signature)

  given signedEncoder[A: Encoder]: Encoder[Signed[A]] with
    def apply(c: Signed[A]): Json =
      Json.obj(
        "value"     -> c.value.asJson,
        "signature" -> c.signature.asJson
      )

  given signedEq[A: Eq]: Eq[Signed[A]] with
    def eqv(x: Signed[A], y: Signed[A]): Boolean =
      x.value === y.value && x.signature === y.signature

trait Signable[-A] { self =>
  def apply(a: A): Array[Byte]

  final def contraMap[B](f: B => A): Signable[B] =
    new Signable[B]:
      def apply(b: B): Array[Byte] =
        self(f(b))
}

object Signable:
  inline def apply[A](using ev: Signable[A]): ev.type = ev

  given stringSignable: Signable[String] with
    inline def apply(s: String): Array[Byte] =
      s.getBytes(StandardCharsets.UTF_8)

  given arrayByteSignable: Signable[Array[Byte]] with
    inline def apply(s: Array[Byte]): Array[Byte] = s

  given jsonSignable: Signable[Json] with
    inline def apply(j: Json): Array[Byte] =
      stringSignable(j.noSpacesSortKeys)

  def fromEncoder[A: Encoder]: Signable[A] =
    new Signable[A]:
      def apply(a: A): Array[Byte] =
        jsonSignable(a.asJson)

type VerifyFun = [A] => (Signable[A]) ?=> (Signed[A]) => Boolean

def withVerify[A](key: RSAPublicKey)(f: VerifyFun => A): A =
  val bc        = new BouncyCastleProvider()
  val signature = java.security.Signature.getInstance("SHA256withRSA/PSS", bc)
  signature.setParameter(new PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1))
  signature.initVerify(key)
  val decoder = Base64.getUrlDecoder()

  val verify = [A] =>
    (A: Signable[A]) ?=>
      (s: Signed[A]) =>
        val value = A(s.value)
        val sig   = decoder.decode(s.signature)
        signature.update(value)
        signature.verify(sig)

  f(verify)
