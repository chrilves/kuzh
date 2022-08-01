package chrilves.kuzh.back.models.assembly

import io.circe.*
import io.circe.syntax.*

import scala.collection.*

import cats.effect.kernel.Sync
import java.util.UUID

import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.lib.crypto.*

final case class State(
    questions: List[String],
    presences: immutable.Map[Member.Fingerprint, Member.Presence],
    status: State.Status
):
  def question: Option[String] = questions.headOption

object State:
  def init[F[_]: Sync]: F[State] = Sync[F].delay(
    State(
      questions = Nil,
      presences = immutable.Map.empty,
      status = Status.Waiting(java.util.UUID.randomUUID(), None, immutable.Map.empty)
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
        "status" -> ps.status.asJson
      )

  enum Status:
    case Waiting(
        id: UUID,
        question: Option[String],
        ready: immutable.Map[Member.Fingerprint, Member.Readiness]
    )
    case Proposed(
        harvest: Harvest,
        remaining: immutable.Set[Member.Fingerprint]
    )
    case Harvesting(harvest: Harvest, phase: Phase)
    case Hidden

  object Status:
    given statusEncoder: Encoder[Status] with
      final def apply(s: Status): Json =
        s match
          case Waiting(id, questionOpt, ready) =>
            Json.obj(
              "tag"      -> "waiting".asJson,
              "id"       -> id.toString().asJson,
              "question" -> questionOpt.asJson,
              "ready" -> Json.fromValues(ready.map { case (fp, r) =>
                Json.obj(
                  "member"    -> fp.asJson,
                  "readiness" -> r.asJson
                )
              })
            )
          case Proposed(harvest, remaining) =>
            Json.obj(
              "tag"       -> "proposed".asJson,
              "harvest"   -> harvest.asJson,
              "remaining" -> remaining.toList.asJson
            )
          case Harvesting(harvest, phase) =>
            Json.obj(
              "tag"     -> "harvesting".asJson,
              "harvest" -> harvest.asJson,
              "phase"   -> phase.asJson
            )
          case Hidden =>
            Json.obj(
              "tag" -> "hidden".asJson
            )

  enum Event:
    case MemberPresence(member: Member.Fingerprint, presence: Member.Presence)
    case MemberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)
    case QuestionDone(id: UUID)
    case NewQuestions(id: UUID, questions: List[String])
    case HarvestAccepted(member: Member.Fingerprint)

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
          case MemberBlocking(fp, b) =>
            Json.obj(
              "tag"      -> Json.fromString("member_blocking"),
              "member"   -> fp.asJson,
              "blocking" -> (b: Member.Readiness).asJson
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
          case HarvestAccepted(member) =>
            Json.obj(
              "tag"    -> "harvest_accepted".asJson,
              "member" -> member.asJson
            )
