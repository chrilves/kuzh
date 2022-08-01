package chrilves.kuzh.back.models.assembly

import io.circe.*
import io.circe.syntax.*
import chrilves.kuzh.back.models.Harvest

enum AssemblyEvent:
  case PublicSynchro(public: State)
  case StatusSynchro(status: State.Status)
  case PublicEvent(public: State.Event)
  case Error(reason: String, fatal: Boolean)

object AssemblyEvent:
  given assemblyEventEncoder: Encoder[AssemblyEvent] with
    final def apply(i: AssemblyEvent): Json =
      i match
        case PublicSynchro(p) =>
          Json.obj(
            "tag"   -> Json.fromString("state"),
            "state" -> p.asJson
          )
        case StatusSynchro(status) =>
          Json.obj(
            "tag"    -> Json.fromString("status"),
            "status" -> status.asJson
          )
        case PublicEvent(p) =>
          Json.obj(
            "tag"          -> Json.fromString("public_event"),
            "public_event" -> p.asJson
          )
        case Error(reason, fatal) =>
          Json.obj(
            "tag"    -> Json.fromString("error"),
            "reason" -> Json.fromString(reason),
            "fatal"  -> Json.fromBoolean(fatal)
          )
