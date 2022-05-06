package chrilves.kuzhback

import cats.effect.Sync
import cats.implicits._
import org.http4s.HttpRoutes
import org.http4s.dsl.Http4sDsl

object KuzhbackRoutes:
  
  def helloWorldRoutes[F[_]: Sync](H: HelloWorld[F]): HttpRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    HttpRoutes.of[F] { case GET -> Root / "hello" / name =>
      for
        greeting <- H.hello(HelloWorld.Name(name))
        resp     <- Ok(greeting)
      yield resp
    }

  def memberRoutes[F[_]: Sync](H: HelloWorld[F]): HttpRoutes[F] =
    val dsl = new Http4sDsl[F] {}
    import dsl._
    HttpRoutes.of[F] { case GET -> Root / "assembly" / id / "ws" =>
      for
        greeting <- H.hello(HelloWorld.Name(name))
        resp     <- Ok(greeting)
      yield resp
    }
