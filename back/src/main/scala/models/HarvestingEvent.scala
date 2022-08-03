package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

enum HarvestingEvent:
  case Accepted(member: Member.Fingerprint)
  case Invalid

object HarvestingEvent:
  given harvestingEventEncoder: Encoder[HarvestingEvent] with
    final def apply(e: HarvestingEvent): Json =
      e match
        case Accepted(member) =>
          Json.obj(
            "tag"    -> "accepted".asJson,
            "member" -> member.asJson
          )
        case Invalid =>
          Json.obj(
            "tag" -> "invalid".asJson
          )
