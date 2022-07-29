package chrilves.kuzh.back.models

import org.http4s.websocket.WebSocketFrame
import cats.effect.kernel.Sync
import cats.syntax.all.*
import cats.effect.std.Queue
import cats.effect.kernel.Async
import cats.effect.kernel.Ref
import io.circe.*
import io.circe.syntax.*
import io.circe.parser.*
import java.util.Base64
import org.bouncycastle.util.encoders.Base64Encoder

import chrilves.kuzh.back.*
import chrilves.kuzh.back.models.assembly.*
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
      inline def sendHandshake(handshake: Handshake): F[Unit] =
        queue.offer(Some(WebSocketFrame.Text(handshake.asJson.noSpaces)))

      def onClose(message: String): F[Unit] =
        import Status.*
        val terminate =
          queue.offer(None).attempt.void

        Async[F].delay(println(s"=> Closing connection because of $message")) *>
          status.get.flatMap {
            case Initial() | _: Challenged[F] =>
              sendHandshake(Handshake.Error(message, true)) *> terminate
            case Established(assembly, member) =>
              for
                _ <- terminate
                _ <- assembly.removeMember(member).attempt
              yield ()
          }

      val send: fs2.Stream[F, WebSocketFrame] =
        fs2.Stream.fromQueueNoneTerminated(queue)

      def receive(input: fs2.Stream[F, WebSocketFrame]): fs2.Stream[F, Unit] =
        import WebSocketFrame.*

        def read[A: Decoder](from: String)(s: String)(f: A => F[Unit]): F[Unit] =
          Async[F].delay {
            println(s"[${from}] Received websocket message: ${s}")
          } *>
            (parse(s) match
              case Left(e) =>
                onClose(s"[${from}] Parsing error of ${s}: ${e}")
              case Right(json) =>
                json.as[A] match
                  case Left(e) =>
                    onClose(s"[${from}] Decoding error of ${json}: ${e}")
                  case Right(a) =>
                    f(a).handleErrorWith(e => onClose(s"[${from}] Treatement errror of ${a}: ${e}"))
            )

        input.foreach {
          case t: Text if t.last =>
            import Status.*
            status.get.flatMap {
              case Initial() =>
                read[Handshake]("initial")(t.str) {
                  case cp @ Handshake.Crententials(id, secret, member) =>
                    assemblies.withAssembly(id, secret) {
                      case Some(asm) =>
                        for
                          challenge           <- lib.Random.bytes(32)
                          storedIdentityProof <- asm.identityProof(member)
                          _ <- status.set(Challenged(asm, member, challenge, storedIdentityProof))
                          _ <- sendHandshake(
                            Handshake.Challenge(challenge, storedIdentityProof.isEmpty)
                          )
                        yield ()
                      case None =>
                        onClose(s"No Assembly or wrong secret for ${cp}")
                    }
                  case h =>
                    val msg = s"Protocol Error: wrong message ${h}"
                    sendHandshake(Handshake.Error(msg, true)) *> onClose(msg)
                }

              case Challenged(assembly, member, challenge, storedIdentityProof) =>
                read[Handshake]("challenged")(t.str) {
                  case cr: Handshake.ChallengeResponse =>
                    cr.check(member, storedIdentityProof, challenge) match
                      case Some(id) =>
                        def handler(message: AssemblyEvent): F[Unit] =
                          queue.offer(Some(WebSocketFrame.Text(message.asJson.noSpaces)))

                        for
                          _ <- status.set(Status.Established[F](assembly, member))
                          _ <-
                            (if storedIdentityProof.isEmpty
                             then
                               assembly
                                 .registerMember(id)
                                 .handleErrorWith(e => onClose(s"Member registration error ${e}"))
                             else Async[F].pure(()))
                          _ <- sendHandshake(Handshake.Established)
                          _ <- assembly
                            .memberChannel(member, handler)
                            .handleErrorWith(e => onClose(s"Member channel error ${e}"))
                        yield ()
                      case None =>
                        onClose("Identity Proof did not pass check!")

                  case h =>
                    onClose(s"Protocol Error: wrong message ${h}")
                }

              case Established(assembly, member) =>
                read[MemberEvent]("established")(t.str) { mfm =>
                  assembly.memberMessage(member, mfm)
                }
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
    ) extends Status[F]
