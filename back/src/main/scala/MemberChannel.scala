package chrilves.kuzhback

import cats.Applicative
import cats.implicits.*
import io.circe.{Encoder, Json}
import org.http4s.EntityEncoder
import org.http4s.circe.*
import org.http4s.server.websocket.WebSocketBuilder

trait MemberChannel[F[_]]

object Member:
    opaque type PK = String
    opaque type SHA = String

    extension (publicKey: PK) def checkSum: SHA = ???
    
    enum Status:
        case Absent, Busy, Ready

    final case class Info(
        publicKey: PK,
        name: String,
        score: Long,
        status: Status
    )

    enum Diff:
        case AllMembers(members: Set[Info])
        case PresentMember(info: Info)
        case AbsentMember(sha: SHA)



object MemberChannel:
    enum Connection:
        case Initial
        case ChallengeSent(publicKey: Member.PK, challenge: String)
        case Verified(publicKey: Member.PK)

    enum State:





