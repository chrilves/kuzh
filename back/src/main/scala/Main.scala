package chrilves.kuzh.back

import cats.effect.{ExitCode, IO, IOApp}

object Main extends IOApp:
  def run(args: List[String]) =
    KuzhServer.stream[IO].use(_ => IO.pure(ExitCode.Success))
