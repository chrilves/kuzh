package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

enum MemberEvent:
  case Ready

object MemberEvent:
  given memberEventEncoder: Encoder[MemberEvent] with
    final def apply(m: MemberEvent): Json =
      m match
        case Ready =>
          Json.obj(
            "tag" -> Json.fromString("ready")
          )

  given messageFromMemberDecoder: Decoder[MemberEvent] with
    def apply(c: HCursor): Decoder.Result[MemberEvent] =
      c.downField("tag").as[String].flatMap {
        case "ready" =>
          Decoder.resultInstance.pure(MemberEvent.Ready)
        case s =>
          Decoder.resultInstance
            .raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
      }
