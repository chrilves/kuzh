package chrilves.kuzh.back.models

import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.*
import chrilves.kuzh.back.lib.crypto.*
import cats.Applicative
import cats.implicits.*
import io.circe.{Encoder, Json}
import cats.Applicative
import cats.Monad
import cats.implicits.*
import cats.effect.*
import org.http4s.*
import org.http4s.dsl.io.*
import org.http4s.implicits.*
import org.http4s.circe.*
import org.http4s.circe.CirceEntityCodec.*
import io.circe.*
import io.circe.generic.auto.*
import io.circe.syntax.*
import java.util.{UUID, Base64}
import java.nio.charset.StandardCharsets
import org.typelevel.ci.*
import org.http4s.Header
import org.http4s.Header.Single
import com.nimbusds.jose.jwk
import com.nimbusds.jose.jwk.JWK
import com.nimbusds.jose.jwk.RSAKey
import java.security.*
import java.security.interfaces.*
import java.security.spec.PSSParameterSpec
import java.security.spec.MGF1ParameterSpec
import org.bouncycastle.jce.provider.BouncyCastleProvider
import cats.kernel.Eq
import java.time.Instant
import scala.collection.*
import cats.instances.StringInstances
import scala.concurrent.duration.FiniteDuration

import chrilves.kuzh.back.models.Assembly

object Messages:
  enum Type:
    case Update
    case Request(timeout: FiniteDuration)

  final case class Send(message: String, signature: String)
/*
  enum MemberDiff[+M, +A, +B]:
    case Presence(presence: Member.Presence)
    case Readiness(readiness: Member.Readiness)
    case Sent(message: M)
    case Accept(response: Harvest.Protocol.Accept.Response[A, B])
    case Validate(response: Harvest.Protocol.Validation.Response[A, B])
    case Finished(response: Harvest.Protocol.Finished.Response[A, B])

  final case class Incoming(member: Member.Fingerprint, message: MemberDiff[Send, ?, ?])

  final case class Outgoing(member: Member.Fingerprint, message: Outgoing.Message)
  object Outgoing:
    enum Message:
      case MemberDiff(member: Member.Fingerprint, diff: Messages.MemberDiff[Unit, ?, ?])
      case Next(send: Send)
      case State(state: Option[Assembly.State])
      case Error(reason: Harvest.FailureReason[?,?], state: Assembly.State)

  final case class Connection[F[_]](sendReceive: fs2.Pipe[F, Incoming, Outgoing], onClose: F[Unit])
 */
/*
object Update:
  import Messages.*
  import MemberDiff.*

  def update[F[_]](
    state: Assembly.State,
    incomming: Messages.Incoming
  ): (Assembly.State, List[Messages.Outgoing]) =
    incomming.message match
      case Presence(presence) =>
        val newState = state.copy(presence = state.presence + (incoming.member -> presence))

      case Readiness(readiness) =>
        ???
      case Sent(Send(msg, sig)) =>
        ???
      case Accept(response) =>
        ???
      case Validate(response) =>
        ???
      case Finished(response) =>
        ???
 */
