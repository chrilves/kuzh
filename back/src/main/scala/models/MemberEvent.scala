package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

import chrilves.kuzh.back.lib.crypto.*

enum MemberEvent:
  case Blocking(blockingness: Member.Blockingness)
  case AcceptHarvest
  case HashNext(message: Base64UrlEncoded)
  case Hashes(hashes: List[Base64UrlEncoded])
  case Invalid
  case Vallid(signature: Signature[HarvestProtocol.Proof])
  case RealNext(message: Base64UrlEncoded)
  case Reals(reals: List[Ballot])

object MemberEvent:

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
        case "hash_next" =>
          for hashNext <- c.downField("message").as[String]
          yield MemberEvent.HashNext(Base64UrlEncoded.unsafeFromString(hashNext))
        case "hashes" =>
          for l <- c.downField("hashes").as[List[String]]
          yield MemberEvent.Hashes(l.sorted.map(Base64UrlEncoded.unsafeFromString(_)))
        case "invalid" =>
          pure(MemberEvent.Invalid)
        case "valid" =>
          for v <- c.downField("signature").as[Signature[HarvestProtocol.Proof]]
          yield MemberEvent.Vallid(v)
        case "real_next" =>
          for r <- c.downField("message").as[String]
          yield MemberEvent.RealNext(Base64UrlEncoded.unsafeFromString(r))
        case "reals" =>
          for r <- c.downField("reals").as[List[Ballot]]
          yield MemberEvent.Reals(r)
        case s =>
          raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
      }
