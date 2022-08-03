package chrilves.kuzh.back.models.assembly

import chrilves.kuzh.back.models.Member
import java.util.UUID
import io.circe.*
import io.circe.syntax.*

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
