package chrilves.kuzh.back.models.assembly

import scala.collection.*
import chrilves.kuzh.back.models.*
import io.circe.*
import io.circe.syntax.*

enum Phase:
  case Proposed(remaining: immutable.Set[Member.Fingerprint])
  case Started(protocolState: HarvestProtocol)

object Phase:
  given phaseEncoder[A]: Encoder[Phase] with
    final def apply(s: Phase): Json =
      s match
        case Proposed(remaining) =>
          Json.obj(
            "tag"       -> "proposed".asJson,
            "remaining" -> remaining.toList.asJson
          )
        case Started(_) =>
          Json.obj(
            "tag" -> "started".asJson
          )
