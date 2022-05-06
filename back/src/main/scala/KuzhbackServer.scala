package chrilves.kuzhback

import cats.effect.{Async, Resource}
import cats.syntax.all.*
import com.comcast.ip4s.*
import fs2.Stream
import org.http4s.ember.client.EmberClientBuilder
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits.*
import org.http4s.server.middleware.Logger

object KuzhbackServer:
  def stream[F[_]: Async]: Resource[F, Nothing] =
    val helloWorldAlg = HelloWorld.impl[F]
    val httpApp = (
      KuzhbackRoutes.helloWorldRoutes[F](helloWorldAlg)
    ).orNotFound

    // With Middlewares in place
    val finalHttpApp = Logger.httpApp(true, true)(httpApp)
    EmberServerBuilder
      .default[F]
      .withHost(ipv4"0.0.0.0")
      .withPort(port"8081")
      .withHttpApp(finalHttpApp)
      .build >> Resource.eval(Async[F].never)