package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

import chrilves.kuzh.back.lib.crypto.*

enum MemberEvent:
  case Blocking(blockingness: Member.Blockingness)
  case AcceptHarvest

object MemberEvent:
  given memberEventEncoder: Encoder[MemberEvent] with
    final def apply(m: MemberEvent): Json =
      m match
        case Blocking(b) =>
          Json.obj(
            "tag" -> "blocking".asJson,
            "blocking" -> (b match
              case Member.Readiness.Blocking => "blocking"
              case Member.Readiness.Ready    => "ready"
            ).asJson
          )
        case AcceptHarvest =>
          Json.obj(
            "tag" -> "accept_harvest".asJson
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
        case "accept_harvest" =>
          pure(MemberEvent.AcceptHarvest)
        case s =>
          raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
      }
