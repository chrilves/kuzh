package chrilves.kuzh.back.models.assembly

import io.circe.*
import io.circe.syntax.*

import scala.collection.*

import chrilves.kuzh.back.models.Member
import cats.effect.kernel.Sync
import java.util.UUID

final case class State(
    questions: List[String],
    presences: immutable.Map[Member.Fingerprint, Member.Presence],
    id: java.util.UUID,
    status: State.Status
):
  def question: Option[String] = questions.headOption

object State:
  def init[F[_]: Sync]: F[State] = Sync[F].delay(
    State(
      questions = Nil,
      presences = immutable.Map.empty,
      id = java.util.UUID.randomUUID(),
      status = Status.Waiting(None, immutable.Map.empty)
    )
  )

  given stateEncoder: Encoder[State] with
    final def apply(ps: State): Json =
      Json.obj(
        "questions" -> Json.fromValues(ps.questions.map(Json.fromString)),
        "presences" -> Json.fromValues(ps.presences.map { case (fp, presence) =>
          Json.obj(
            "member"   -> fp.asJson,
            "presence" -> presence.asJson
          )
        }),
        "id"     -> Json.fromString(ps.id.toString()),
        "status" -> ps.status.asJson
      )

  enum HarvestType:
    case Questions, Answers

  object HarvestType:
    given harvestingTypeEncoder: Encoder[HarvestType] with
      final def apply(ht: HarvestType): Json =
        ht match
          case Questions => Json.fromString("questions")
          case Answers   => Json.fromString("answers")

  enum Status:
    case Waiting(
        question: Option[String],
        ready: immutable.Map[Member.Fingerprint, Member.Readiness]
    )
    case Harvesting(tpe: HarvestType, mmebers: Set[Member.Fingerprint])

  object Status:
    given statusEncoder: Encoder[Status] with
      final def apply(s: Status): Json =
        s match
          case Waiting(questionOpt, ready) =>
            Json.obj(
              "tag"      -> Json.fromString("waiting"),
              "question" -> questionOpt.asJson,
              "ready" -> Json.fromValues(ready.map { case (fp, r) =>
                Json.obj(
                  "member"    -> fp.asJson,
                  "readiness" -> r.asJson
                )
              })
            )
          case Harvesting(tpe, participants) =>
            Json.obj(
              "tag"     -> Json.fromString("harvesting"),
              "type"    -> tpe.asJson,
              "members" -> Json.fromValues(participants.toList.map(_.asJson))
            )

  enum Event:
    case MemberPresence(member: Member.Fingerprint, presence: Member.Presence)
    case MemberReady(member: Member.Fingerprint)
    case QuestionDone(id: UUID)
    case NewQuestions(id: UUID, questions: List[String])

  object Event:
    given AssemblyEventEncoder: Encoder[Event] with
      final def apply(e: Event): Json =
        e match
          case MemberPresence(fp, p) =>
            Json.obj(
              "tag"      -> Json.fromString("member_presence"),
              "member"   -> fp.asJson,
              "presence" -> p.asJson
            )
          case MemberReady(fp) =>
            Json.obj(
              "tag"    -> Json.fromString("member_ready"),
              "member" -> fp.asJson
            )
          case QuestionDone(id) =>
            Json.obj(
              "tag" -> Json.fromString("question_done"),
              "id"  -> Json.fromString(id.toString())
            )
          case NewQuestions(id, ql) =>
            Json.obj(
              "tag"       -> Json.fromString("new_questions"),
              "id"        -> Json.fromString(id.toString()),
              "questions" -> Json.fromValues(ql.map(Json.fromString))
            )
