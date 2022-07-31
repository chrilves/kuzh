package chrilves.kuzh.back.models.assembly

import io.circe.*
import io.circe.syntax.*

import scala.collection.*

import chrilves.kuzh.back.models.Member
import cats.effect.kernel.Sync
import java.util.UUID

final case class State[+A](
    questions: List[String],
    presences: immutable.Map[Member.Fingerprint, Member.Presence],
    id: java.util.UUID,
    status: State.Status[A]
):
  def question: Option[String] = questions.headOption

object State:
  def init[F[_]: Sync, A]: F[State[A]] = Sync[F].delay(
    State(
      questions = Nil,
      presences = immutable.Map.empty,
      id = java.util.UUID.randomUUID(),
      status = Status.Waiting(None, immutable.Map.empty)
    )
  )

  given stateEncoder[A: Encoder]: Encoder[State[A]] with
    final def apply(ps: State[A]): Json =
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

  enum Status[+A]:
    case Waiting(
        question: Option[String],
        ready: immutable.Map[Member.Fingerprint, Member.Readiness]
    )
    case Harvesting[A](participant: Set[Member.Fingerprint], phase: A) extends Status[A]

  object Status:
    given statusEncoder[A: Encoder]: Encoder[Status[A]] with
      final def apply(s: Status[A]): Json =
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
          case Harvesting(participants, phase) =>
            Json.obj(
              "tag"          -> Json.fromString("harvesting"),
              "participants" -> Json.fromValues(participants.toList.map(_.asJson)),
              "phase"        -> (phase: A).asJson
            )

  enum Event:
    case MemberPresence(member: Member.Fingerprint, presence: Member.Presence)
    case MemberBlocking(member: Member.Fingerprint, blocking: Member.Blockingness)
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
