package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

enum MemberEvent:
  case Blocking(blockingness: Member.Blockingness)

object MemberEvent:
  given memberEventEncoder: Encoder[MemberEvent] with
    final def apply(m: MemberEvent): Json =
      m match
        case Blocking(b) =>
          Json.obj(
            "tag" -> Json.fromString("blocking"),
            "blocking" -> Json.fromString(b match
              case Member.Readiness.Blocking => "blocking"
              case Member.Readiness.Ready    => "ready"
            )
          )

  given messageFromMemberDecoder: Decoder[MemberEvent] with
    def apply(c: HCursor): Decoder.Result[MemberEvent] =
      import Decoder.resultInstance.*
      c.downField("tag").as[String].flatMap {
        case "blocking" =>
          c.downField("blocking").as[String].flatMap {
            case "blocking" => pure(MemberEvent.Blocking(Member.Readiness.Blocking))
            case "ready"    => pure(MemberEvent.Blocking(Member.Readiness.Ready))
            case s =>
              raiseError(
                DecodingFailure(s"Invalid message from member tag blocking, value '$s'.", Nil)
              )
          }
        case s =>
          raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
      }
