package chrilves.kuzhback

import cats.effect.{Async, Resource}
import cats.syntax.all.*
import com.comcast.ip4s.*
import fs2.Stream
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits.*
import org.http4s.server.middleware.{Logger,CORS}
import cats.effect.LiftIO
import chrilves.kuzhback.middleware.*
import org.http4s.HttpRoutes
import cats.*
import cats.effect.*

object KuzhbackServer:
  def stream[F[_]: Async: LiftIO]: Resource[F, Nothing] =
    val assemblyAlg = AssemblyAPI.memory.nt[F](new (IO ~> F) {
      def apply[A](x: IO[A]): F[A] = LiftIO[F].liftIO(x)
    })
    val httpApp= (
      KuzhbackRoutes.assemblyPost[F](assemblyAlg) <+>
      AssemblyAuth(assemblyAlg)(KuzhbackRoutes.assemblyRoutes[F](assemblyAlg))
    ).orNotFound

    // With Middlewares in place
    val finalHttpApp =
      CORS.policy.withAllowOriginAll(Logger.httpApp(true, true)(httpApp))

    EmberServerBuilder
      .default[F]
      .withHost(ipv4"0.0.0.0")
      .withPort(port"8081")
      .withHttpApp(finalHttpApp)
      .build >> Resource.eval(Async[F].never)