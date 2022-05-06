package chrilves.kuzhback

import cats.Applicative
import cats.implicits.*
import io.circe.{Encoder, Json}
import org.http4s.EntityEncoder
import org.http4s.circe.*

trait HelloWorld[F[_]]:
  def hello(n: HelloWorld.Name): F[HelloWorld.Greeting]

object HelloWorld:
  given apply[F[_]](using ev: HelloWorld[F]): HelloWorld[F] = ev

  final case class Name(name: String) extends AnyVal

  /** More generally you will want to decouple your edge representations from your internal data
    * structures, however this shows how you can create encoders for your data.
    */
  final case class Greeting(greeting: String) extends AnyVal
  object Greeting:
    given greetingEncoder: Encoder[Greeting] = new Encoder[Greeting] {
      final def apply(a: Greeting): Json = Json.obj(
        ("message", Json.fromString(a.greeting))
      )
    }
    given greetingEntityEncoder[F[_]]: EntityEncoder[F, Greeting] =
      jsonEncoderOf[F, Greeting]

  def impl[F[_]: Applicative]: HelloWorld[F] = new HelloWorld[F] {
    def hello(n: HelloWorld.Name): F[HelloWorld.Greeting] =
      Greeting("Hello, " + n.name).pure[F]
  }
