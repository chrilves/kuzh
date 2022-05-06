package chrilves.kuzh.back

import cats.effect.{Async, Resource}
import cats.syntax.all.*
import com.comcast.ip4s.*
import fs2.Stream
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits.*
import org.http4s.server.middleware.{Logger, CORS}
import cats.effect.LiftIO
import chrilves.kuzh.back.middleware.*
import chrilves.kuzh.back.services.*
import org.http4s.HttpRoutes
import cats.*
import cats.effect.*
import org.http4s.server.websocket.WebSocketBuilder2

object KuzhServer:
  def stream[F[_]: Async: LiftIO]: Resource[F, Nothing] =
    val assemblyAlg = AssemblyManagement.inMemory[F]
    def httpApp(webSocketBuilder: WebSocketBuilder2[F]) =
      ((KuzhRoutes.assemblyPost[F](assemblyAlg, webSocketBuilder)) <+>
        AssemblyAuth(assemblyAlg)(KuzhRoutes.assemblyRoutes[F])).orNotFound

    // With Middlewares in place
    def finalHttpApp(webSocketBuilder: WebSocketBuilder2[F]) =
      CORS.policy.withAllowOriginAll(Logger.httpApp(true, true)(httpApp(webSocketBuilder)))

    EmberServerBuilder
      .default[F]
      .withHost(ipv4"0.0.0.0")
      .withPort(port"9000")
      .withHttpWebSocketApp(finalHttpApp)
      .build >> Resource.eval(Async[F].never)
