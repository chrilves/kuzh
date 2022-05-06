package chrilves.kuzhback

import cats.effect.{ExitCode, IO, IOApp}

object Main extends IOApp:
  def run(args: List[String]) =
    KuzhbackServer.stream[IO].use(_ => IO.pure(ExitCode.Success))
