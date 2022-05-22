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
  extension (s: Base64UrlEncoded) inline def asString: String = s

  def unsafeFromString(s: String): Base64UrlEncoded = s

  inline def encode(arr: Array[Byte]): Base64UrlEncoded =
    new String(Base64.getUrlEncoder.encode(arr), StandardCharsets.UTF_8)

  given Signable[Base64UrlEncoded] with
    def apply(a: String): Array[Byte] =
      Base64.getUrlDecoder.decode(a)

  def hash(msg: String): Base64UrlEncoded =
    val md = MessageDigest.getInstance("SHA-256")
    md.update(msg.getBytes(StandardCharsets.UTF_8))
    Base64UrlEncoded.encode(md.digest())

opaque type Signature[+A] = String
object Signature:
  inline def fromString[A](str: String): Signature[A] = str

  inline given [A]: Encoder[Signature[A]] = StringInstances.encoder
  inline given [A]: Decoder[Signature[A]] = StringInstances.decoder
  inline given [A]: Eq[Signature[A]]      = StringInstances.eq

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

trait Signable[-A]:
  def apply(a: A): Array[Byte]

object Signable:
  inline def apply[A](using ev: Signable[A]): ev.type = ev

  given stringSignable: Signable[String] with
    inline def apply(s: String): Array[Byte] =
      s.getBytes(StandardCharsets.UTF_8)

  given arrayByteSignable: Signable[Array[Byte]] with
    inline def apply(s: Array[Byte]): Array[Byte] = s

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
