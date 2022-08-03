package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*
import chrilves.kuzh.back.models.Harvest

enum AssemblyEvent:
  case State(public: assembly.State[Any])
  case Status(status: assembly.Status[Any])
  case Public(public: assembly.Event)
  case Harvesting(harvesting: HarvestingEvent)
  case Protocol(protocol: HarvestProtocol.Event)
  case Error(error: String, fatal: Boolean)

object AssemblyEvent:
  given assemblyEventEncoder: Encoder[AssemblyEvent] with
    final def apply(i: AssemblyEvent): Json =
      i match
        case State(p) =>
          Json.obj(
            "tag"   -> Json.fromString("state"),
            "state" -> p.asJson
          )
        case Status(status) =>
          Json.obj(
            "tag"    -> Json.fromString("status"),
            "status" -> status.asJson
          )
        case Public(e) =>
          Json.obj(
            "tag"    -> Json.fromString("public"),
            "public" -> e.asJson
          )
        case Harvesting(e) =>
          Json.obj(
            "tag"        -> Json.fromString("harvesting"),
            "harvesting" -> e.asJson
          )
        case Protocol(e) =>
          Json.obj(
            "tag"      -> Json.fromString("protocol"),
            "protocol" -> e.asJson
          )
        case Error(error, fatal) =>
          Json.obj(
            "tag"   -> Json.fromString("error"),
            "error" -> Json.fromString(error),
            "fatal" -> Json.fromBoolean(fatal)
          )
