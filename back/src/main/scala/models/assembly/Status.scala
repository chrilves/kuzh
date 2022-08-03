package chrilves.kuzh.back.models.assembly

import cats.effect.kernel.Sync
import java.util.UUID
import scala.collection.*
import io.circe.*
import io.circe.syntax.*

import chrilves.kuzh.back.models.*

enum Status[+A]:
  case Waiting(
      id: UUID,
      question: Option[String],
      ready: immutable.Map[Member.Fingerprint, Member.Readiness]
  )                                               extends Status[Nothing]
  case Harvesting(harvest: Harvest, phase: Phase) extends Status[Nothing]
  case Hidden                                     extends Status[Any]

  final def participants: immutable.Set[Member.Fingerprint] =
    this match
      case Harvesting(h, _) => h.participants
      case _                => immutable.Set.empty

  final def harvestOpt: Option[Harvest] =
    this match
      case Harvesting(h, _) => Some(h)
      case _                => None

  final def isWaiting: Boolean =
    this match
      case Waiting(_, _, _) => true
      case _                => false

object Status:
  def init[F[_]: Sync]: F[Status[Nothing]] = Sync[F].delay(
    Status.Waiting(java.util.UUID.randomUUID(), None, immutable.Map.empty)
  )

  given statusEncoder[A]: Encoder[Status[A]] with
    final def apply(s: Status[A]): Json =
      s match
        case Waiting(id, questionOpt, ready) =>
          Json.obj(
            "tag"      -> "waiting".asJson,
            "id"       -> id.toString().asJson,
            "question" -> questionOpt.asJson,
            "ready" -> Json.fromValues(ready.map { case (fp, r) =>
              Json.obj(
                "member"    -> fp.asJson,
                "readiness" -> r.asJson
              )
            })
          )
        case Harvesting(harvest, phase) =>
          Json.obj(
            "tag"     -> "harvesting".asJson,
            "harvest" -> harvest.asJson,
            "phase"   -> phase.asJson
          )
        case Hidden =>
          Json.obj(
            "tag" -> "hidden".asJson
          )
