package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

import scala.collection.*

import cats.effect.kernel.Sync
import java.util.UUID

import chrilves.kuzh.back.models.*
import chrilves.kuzh.back.lib.crypto.*
import java.time.Instant

final case class State[+A](
    questions: List[String],
    present: Set[Member.Fingerprint],
    absent: Map[Member.Fingerprint, Instant],
    status: Status[A]
):
  def question: Option[String] = questions.headOption

object State:
  def init[F[_]: Sync]: F[State[Unit]] = Sync[F].delay(
    State(
      questions = Nil,
      present = Set.empty,
      absent = Map.empty,
      status = Status.Waiting(java.util.UUID.randomUUID(), None, immutable.Map.empty)
    )
  )

  given stateEncoder[A]: Encoder[State[A]] with
    final def apply(ps: State[A]): Json =
      Json.obj(
        "questions" -> ps.questions.map(Json.fromString).asJson,
        "present"   -> ps.present.toList.map(_.asJson).asJson,
        "absent" -> ps.absent.toList
          .map(kv =>
            Json.obj(
              "member" -> kv._1.asJson,
              "since"  -> kv._2.asJson
            )
          )
          .asJson,
        "status" -> ps.status.asJson
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