package chrilves.kuzh.back.models

import cats.*
import cats.effect.*
import cats.implicits.*
import cats.kernel.Eq
import io.circe.*
import io.circe.syntax.*

import scala.collection.*
import java.util.UUID
import scodec.bits.Bases.Alphabets.Base64Url

import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.models.Member.Fingerprint

final case class Harvest(
    id: UUID,
    question: Option[Question],
    participants: immutable.Set[Fingerprint]
)

object Harvest:

  given harvestEncoder: Encoder[Harvest] with
    final def apply(h: Harvest): Json =
      Json.obj(
        "id"           -> h.id.toString.asJson,
        "question"     -> h.question.asJson,
        "participants" -> h.participants.toList.sorted.asJson
      )

  given harvestDecoder: Decoder[Harvest] with
    def apply(c: HCursor): Decoder.Result[Harvest] =
      import Decoder.resultInstance.*
      for
        id           <- c.downField("id").as[String].map(UUID.fromString)
        question     <- c.downField("question").as[Option[Question]]
        participants <- c.downField("participants").as[List[Fingerprint]].map(_.toSet)
      yield Harvest(id, question, participants)

  enum Event:
    case Accepted(member: Member.Fingerprint)
    case Invalid

  object Event:
    given harvestEventEncoder: Encoder[Event] with
      final def apply(e: Event): Json =
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
