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
import chrilves.kuzh.back.lib.*
import chrilves.kuzh.back.services.*
import scodec.bits.ByteVector
import scala.collection.mutable
import cats.effect.std.Semaphore

final case class Connection[F[_]](
    onClose: F[Unit],
    send: fs2.Stream[F, WebSocketFrame],
    receive: fs2.Pipe[F, WebSocketFrame, Unit]
)

object Connection:

  trait Handler[F[_]]:
    def send(event: Assembly.Event): F[Unit]
    def close(): F[Unit]

  def connect[F[_]: Async](assemblies: AssemblyManagement[F]): F[Connection[F[_]]] =
    for
      id         <- Async[F].delay(java.util.UUID.randomUUID())
      pingNumber <- Ref.of[F, Long](Long.MinValue)
      strBuffer  <- Ref.of[F, mutable.StringBuilder](new mutable.StringBuilder)
      status     <- Ref.of[F, Status[F]](Status.Initial[F]())
      queue      <- Queue.unbounded[F, Option[WebSocketFrame]]
    yield
      import Status.*

      def conlog(color: String)(s: String): F[Unit] =
        log(color)(s"{${id}} ${s}")

      def sendMessage(json: Json): F[Unit] =
        status.get.flatMap {
          case Established(assembly, member) =>
            for
              _ <- conlog(Console.YELLOW)(
                s"Sending a message in establshed connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${json.spaces4}."
              )
              _ <- queue.offer(Some(WebSocketFrame.Text(json.noSpacesSortKeys)))
            yield ()
          case Challenged(assembly, member, challenge, storedIdentityProof) =>
            for
              _ <- conlog(Console.YELLOW)(
                s"Sending a message in challenged connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${json.spaces4}."
              )
              _ <- queue.offer(Some(WebSocketFrame.Text(json.noSpacesSortKeys)))
            yield ()
          case Terminated() =>
            conlog(Console.YELLOW)(
              s"Trying to Send a message in terminated connection: ${json.spaces4}"
            )

          case Initial() =>
            for
              _ <- conlog(Console.YELLOW)(
                s"Sending a message in initial connection: ${json.spaces4}"
              )
              _ <- queue.offer(Some(WebSocketFrame.Text(json.noSpacesSortKeys)))
            yield ()
        }

      inline def sendHandshake(handshake: Handshake.Out): F[Unit]  = sendMessage(handshake.asJson)
      inline def sendAssemblyEvent(event: Assembly.Event): F[Unit] = sendMessage(event.asJson)

      def closeConnection(performClose: Boolean): F[Unit] =
        val start =
          if performClose
          then "Closing"
          else "Closed"

        status.getAndSet(Terminated()).flatMap {
          case Established(assembly, member) =>
            for
              _ <- Async[F].whenA(performClose)(queue.offer(None))
              _ <- conlog(Console.BLUE)(
                s"${start} the establshed connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}"
              )
              _ <- assembly.removeMember(member)
            yield ()
          case Challenged(assembly, member, challenge, storedIdentityProof) =>
            for
              _ <- Async[F].whenA(performClose)(queue.offer(None))
              _ <- conlog(Console.BLUE)(
                s"${start} the handshake connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}"
              )
            yield ()
          case Terminated() =>
            conlog(Console.BLUE)(s"${start} to closing a terminated connection.")
          case Initial() =>
            for
              _ <- queue.offer(None)
              _ <- conlog(Console.BLUE)(s"Closing the initial connection.")
            yield ()
        }

      def logError(e: Throwable): F[Unit] =
        status.get.flatMap {
          case Established(assembly, member) =>
            conlog(Console.RED)(
              s"Error in establshed connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${e}"
            )
          case Challenged(assembly, member, challenge, storedIdentityProof) =>
            conlog(Console.RED)(
              s"Error in challenged connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${e}"
            )
          case Terminated() =>
            conlog(Console.RED)(s"Error in terminated connection: ${e}")
          case Initial() =>
            conlog(Console.RED)(s"Error in initial connection: ${e}")
        }

      inline def logAndClose(e: Throwable): F[Unit] =
        logError(e) *> closeConnection(true)

      def logInput(s: String, comment: String): F[Unit] =
        status.get.flatMap {
          case Established(assembly, member) =>
            conlog(Console.GREEN)(
              s"Received ${comment} message in establshed connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${s}"
            )
          case Challenged(assembly, member, challenge, storedIdentityProof) =>
            conlog(Console.GREEN)(
              s"Received ${comment} message in challenged connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${s}"
            )
          case Terminated() =>
            conlog(Console.GREEN)(s"Received ${comment} message in terminated connection: ${s}")
          case Initial() =>
            conlog(Console.GREEN)(s"Received ${comment} message in initial connection: ${s}")
        }

      def exitOnError(error: String): F[Unit] =
        status.get.flatMap {
          case Established(assembly, member) =>
            conlog(Console.MAGENTA)(
              s"Exit in establshed connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${error}"
            ) *>
              sendAssemblyEvent(Assembly.Event.Error(error, true)) *>
              closeConnection(true)
          case Challenged(assembly, member, challenge, storedIdentityProof) =>
            conlog(Console.MAGENTA)(
              s"Exit in challenged connection in assembly ${assembly.info.name}:${assembly.info.id} for ${member}: ${error}"
            ) *>
              sendHandshake(Handshake.Out.Error(error, true)) *>
              closeConnection(true)
          case Terminated() =>
            conlog(Console.MAGENTA)(s"Exit in terminated connection : ${error}")
          case Initial() =>
            conlog(Console.MAGENTA)(s"Exit in initial connection: ${error}") *>
              sendHandshake(Handshake.Out.Error(error, true)) *>
              closeConnection(true)
        }

      val send: fs2.Stream[F, WebSocketFrame] =
        fs2.Stream.fromQueueNoneTerminated(queue)

      def receive(input: fs2.Stream[F, WebSocketFrame]): fs2.Stream[F, Unit] =
        import WebSocketFrame.*

        def withStrBuffer(str: String, last: Boolean)(f: String => F[Unit]): F[Unit] =
          if last
          then
            strBuffer.get.flatMap { buff =>
              if buff.isEmpty
              then f(str)
              else
                for
                  _ <- strBuffer.set(new mutable.StringBuilder)
                  s <- Async[F].delay {
                    buff.++=(str)
                    buff.result()
                  }
                  r <- f(s)
                yield r
            }
          else
            strBuffer.get.map { buff =>
              buff.++=(str)
            }

        def read[A: Decoder](s: String)(f: A => F[Unit]): F[Unit] =
          parse(s) match
            case Left(e) => exitOnError(s"$e")
            case Right(json) =>
              json.as[A] match
                case Left(e) => exitOnError(s"$e")
                case Right(a) =>
                  f(a).handleErrorWith(e => exitOnError(s"$e"))

        input.foreach {
          case t: Text =>
            import Status.*
            logInput(t.str, if t.last then "last" else "ongoing") *>
              withStrBuffer(t.str, t.last) { str =>
                logInput(str, "whole") *>
                  status.get.flatMap {
                    case Initial() =>
                      read[Handshake.In](str) {
                        case cp @ Handshake.In.Crententials(info, member) =>
                          assemblies
                            .withAssemblyInfo(info) {
                              case Some(asm) =>
                                for
                                  challenge           <- lib.Random.bytes(32)
                                  storedIdentityProof <- asm.identityProof(member)
                                  _ <- status.set(
                                    Challenged(asm, member, challenge, storedIdentityProof)
                                  )
                                  _ <- sendHandshake(
                                    Handshake.Out.Challenge(challenge, storedIdentityProof.isEmpty)
                                  )
                                yield ()
                              case None =>
                                exitOnError("Access forbidden to this assembly.")
                            }
                            .handleError(e => exitOnError(s"$e"))
                        case h =>
                          exitOnError(s"Protocol Error: wrong message ${h}")
                      }

                    case Challenged(assembly, member, challenge, storedIdentityProof) =>
                      read[Handshake.In](str) {
                        case cr: Handshake.In.ChallengeResponse =>
                          cr.check(member, storedIdentityProof, challenge) match
                            case Some(id) =>
                              val handler = new Handler[F]:
                                def send(message: Assembly.Event): F[Unit] =
                                  sendMessage(message.asJson)
                                def close(): F[Unit] =
                                  status.getAndSet(Terminated()).flatMap {
                                    case Terminated() =>
                                      conlog(Console.BLUE)(
                                        s"Handler closing a terminated connection for member ${member} in assembly ${assembly.info.name}:${assembly.info.id}."
                                      )
                                    case _ =>
                                      for
                                        _ <- queue.offer(None)
                                        _ <- conlog(Console.BLUE)(
                                          s"Handler closing the connection for member ${member} in assembly ${assembly.info.name}:${assembly.info.id}."
                                        )
                                      yield ()
                                  }

                              assembly
                                .memberChannel(
                                  member,
                                  handler,
                                  (st) =>
                                    status.set(
                                      Status.Established[F](assembly, member)
                                    ) *> sendHandshake(Handshake.Out.Established(st)),
                                  cr.identityProof.orElse(storedIdentityProof)
                                )
                                .handleErrorWith(logAndClose(_))
                            case None =>
                              exitOnError("Identity proof did not pass check")

                        case h =>
                          exitOnError(s"Protocol Error: wrong message ${h}")
                      }

                    case Established(assembly, member) =>
                      read[Member.Event](str) { mfm =>
                        assembly.memberMessage(member, mfm)
                      }
                    case Terminated() =>
                      conlog(Console.YELLOW)(s"Ignoring message: ${str}")
                  }
              }
          case Ping(s) =>
            conlog(Console.YELLOW)(s"Recevied PING ${s}")
          case Pong(s) =>
            conlog(Console.YELLOW)(s"Recevied PONG ${s}")
          case d =>
            exitOnError(s"Unsupported data ${d}")
        }

      val pings: fs2.Stream[F, WebSocketFrame] =
        import scala.concurrent.duration.*
        fs2.Stream.awakeDelay(10.seconds).evalMap { _ =>
          for n <- pingNumber.modify(n => (n + 1, n))
          yield WebSocketFrame.Ping(ByteVector.fromLong(n))
        }

      Connection[F](
        closeConnection(false),
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
