package chrilves.kuzh.back.models

import org.http4s.websocket.WebSocketFrame
import cats.effect.kernel.Sync
import cats.syntax.all.*
import cats.effect.std.Queue
import cats.effect.kernel.Async
import cats.effect.kernel.Ref
import chrilves.kuzh.back.models.Assembly.AssemblyEvent
import io.circe.*
import io.circe.generic.auto.*
import io.circe.syntax.*
import io.circe.parser.*
import java.util.Base64
import org.bouncycastle.util.encoders.Base64Encoder

import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.services.*
import scodec.bits.ByteVector

final case class Connection[F[_]](
    onClose: F[Unit],
    send: fs2.Stream[F, WebSocketFrame],
    receive: fs2.Pipe[F, WebSocketFrame, Unit]
)

object Connection:
  def connect[F[_]: Async](assemblies: AssemblyManagement[F]): F[Connection[F[_]]] =
    for
      pingNumber <- Ref.of[F, Long](Long.MinValue)
      status     <- Ref.of[F, Status[F]](Status.Initial[F]())
      queue      <- Queue.unbounded[F, Option[WebSocketFrame]]
    yield
      def onClose(from: String): F[Unit] =
        import Status.*
        val terminate =
          status.set(Status.Terminated[F]()).void *> queue.offer(None).attempt.void

        Async[F].delay(println(s"=> Closing connection from $from")) *>
          status.get.flatMap {
            case Initial() | _: Challenged[F] =>
              terminate
            case Established(assembly, member) =>
              for
                _   <- terminate
                now <- Async[F].realTimeInstant
                _   <- assembly.memberPresence(member, Member.Presence.Absent(now)).attempt
              yield ()
            case Terminated() =>
              Async[F].pure(())
          }

      val send: fs2.Stream[F, WebSocketFrame] =
        fs2.Stream.fromQueueNoneTerminated(queue)

      def receive(input: fs2.Stream[F, WebSocketFrame]): fs2.Stream[F, Unit] =
        import WebSocketFrame.*

        def read[A: Decoder](s: String)(f: A => F[Unit]): F[Unit] =
          Async[F].delay {
            println(s"Received websocket message: ${s}")
          } *>
            (parse(s) match
              case Left(e) =>
                onClose(s"Parsing error of ${s}: ${e}")
              case Right(json) =>
                json.as[A] match
                  case Left(e) =>
                    onClose(s"Decoding error of ${json}: ${e}")
                  case Right(a) =>
                    f(a).handleErrorWith(e => onClose(s"Treatement errror of ${a}: ${e}"))
            )

        input.foreach {
          case t: Text if t.last =>
            import Status.*
            status.get.flatMap {
              case Initial() =>
                read[ConnectionParameters](t.str) { cp =>
                  assemblies.withAssembly(cp.id, cp.secret) {
                    case Some(asm) =>
                      for
                        challenge           <- lib.Random.bytes(32)
                        storedIdentityProof <- asm.identityProofs(Set(cp.member)).map(_.headOption)
                        _ <- status.set(Challenged(asm, cp.member, challenge, storedIdentityProof))
                        _ <- queue.offer(
                          Some(
                            WebSocketFrame.Text(
                              Json
                                .obj(
                                  "challenge" -> Json.fromString(
                                    Base64UrlEncoded.encode(challenge).asString
                                  ),
                                  "identity_proof_needed" -> Json.fromBoolean(
                                    storedIdentityProof.isEmpty
                                  )
                                )
                                .noSpaces
                            )
                          )
                        )
                      yield ()
                    case None =>
                      onClose(s"No Assembly or wrong secret for ${cp}")
                  }
                }

              case Challenged(assembly, member, challenge, storedIdentityProof) =>
                read[ChallengeResponse](t.str) { cr =>
                  cr.check(member, storedIdentityProof, challenge) match
                    case Some(id) =>
                      val registerIdentityproof =
                        if storedIdentityProof.isEmpty
                        then assembly.registerMember(id)
                        else Async[F].pure(())

                      def handler(message: Assembly.AssemblyEvent): F[Unit] =
                        queue.offer(Some(WebSocketFrame.Text(message.asJson.noSpaces)))

                      for
                        _ <- status.set(Status.Established[F](assembly, member))
                        _ <- assembly
                          .memberChannel(member, handler)
                          .handleErrorWith(e => onClose(s"Member channel error ${e}"))
                      yield ()
                    case None =>
                      onClose("Checking terminated on error.")
                }
              case Established(assembly, member) =>
                read[Assembly.MemberEvent](t.str) { mfm =>
                  assembly.memberMessage(member, mfm)
                }
              case Terminated() =>
                Async[F].pure(())
            }
          case Ping(s) =>
            Async[F].delay(println(s"Recevied PING ${s}"))
          case Pong(s) =>
            Async[F].delay(println(s"Recevied PONG ${s}"))
          case d =>
            onClose(s"Unsupported data ${d}")
        }

      val pings: fs2.Stream[F, WebSocketFrame] =
        import scala.concurrent.duration.*
        fs2.Stream.awakeDelay(10.seconds).evalMap { _ =>
          for n <- pingNumber.modify(n => (n + 1, n))
          yield WebSocketFrame.Ping(ByteVector.fromLong(n))
        }

      Connection[F](
        onClose("Websocket closing!"),
        send.mergeHaltL(pings),
        receive
      )

  enum Status[F[_]]:
    case Initial[F[_]]() extends Status[F]
    case Challenged[F[_]](
        assembly: Assembly[F],
        member: Member.Fingerprint,
        challenge: Array[Byte],
        storedIdentityProof: Option[IdentityProof]
    ) extends Status[F]
    case Established[F[_]](
        assembly: Assembly[F],
        member: Member.Fingerprint
    )                       extends Status[F]
    case Terminated[F[_]]() extends Status[F]

  final case class ConnectionParameters(
      id: Assembly.Info.Id,
      secret: Assembly.Info.Secret,
      member: Member.Fingerprint
  )

  object ConnectionParameters:
    given challengeResponseDecoder: Decoder[ConnectionParameters] with
      def apply(c: HCursor): Decoder.Result[ConnectionParameters] =
        import Decoder.resultInstance.*
        for
          id     <- c.downField("id").as[Assembly.Info.Id]
          secret <- c.downField("secret").as[Assembly.Info.Secret]
          member <- c.downField("member").as[Member.Fingerprint]
        yield ConnectionParameters(id, secret, member)

  final case class ChallengeResponse(
      signature: Signature[Array[Byte]],
      identityProof: Option[IdentityProof]
  ):
    def check(
        member: Member.Fingerprint,
        storedIdentityProof: Option[IdentityProof],
        challenge: Array[Byte]
    ): Option[IdentityProof] =
      // Validity + Cohenrence
      if (
        identityProof.map(_.isValid).getOrElse(true) &&
        identityProof.flatMap(id1 => storedIdentityProof.map(id2 => id1 === id2)).getOrElse(true)
      )
      then
        storedIdentityProof.orElse(identityProof).flatMap { id =>
          lib.crypto.withVerify[Option[IdentityProof]](id.verifyKey) { f =>
            if f[Array[Byte]](Signed(challenge, signature))
            then Some(id)
            else None
          }
        }
      else None

  object ChallengeResponse:
    given challengeResponseDecoder: Decoder[ChallengeResponse] with
      def apply(c: HCursor): Decoder.Result[ChallengeResponse] =
        import Decoder.resultInstance.*
        for
          sig <- c.downField("signature").as[String].map(Signature.fromString[Array[Byte]](_))
          id  <- c.downField("identity_proof").as[Option[IdentityProof]]
        yield ChallengeResponse(sig, id)
