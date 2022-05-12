package chrilves.kuzhback

import cats.Applicative
import cats.implicits.*
import io.circe.{Encoder, Json}
import org.http4s.EntityEncoder
import org.http4s.circe.*
import org.http4s.server.websocket.WebSocketBuilder

import models.*

trait MemberChannel[F[_]]

object MemberChannel:
    enum Connection:
        case Initial
        case ChallengeSent(publicKey: Member.PK, challenge: String)
        case Verified(publicKey: Member.PK)