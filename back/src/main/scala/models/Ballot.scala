package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*
import cats.syntax.eq.*

import chrilves.kuzh.back.models
import chrilves.kuzh.back.lib.crypto.*
import cats.kernel.Eq

final case class Question(
    message: String,
    kind: Question.Kind
)

object Question:
  enum Kind:
    case Open, Closed

  object Kind:
    given kindEncoder: Encoder[Kind] with
      def apply(k: Kind): Json =
        k match
          case Open   => "open".asJson
          case Closed => "closed".asJson

    given kindDecoder: Decoder[Kind] with
      def apply(h: HCursor): Decoder.Result[Kind] =
        import Decoder.resultInstance.*
        h.as[String].flatMap {
          case "open"   => pure(Open)
          case "closed" => pure(Closed)
          case s =>
            raiseError(DecodingFailure(s"Unknown question kind ${s}", Nil))
        }

  given questionEncoder: Encoder[Question] with
    def apply(question: Question): Json =
      Json.obj(
        "message" -> question.message.asJson,
        "kind"    -> question.kind.asJson
      )

  given questionDecoder: Decoder[Question] with
    def apply(h: HCursor): Decoder.Result[Question] =
      import Decoder.resultInstance.*
      for
        question <- h.downField("message").as[String]
        kind     <- h.downField("kind").as[Kind]
      yield Question(question, kind)

enum Ballot:
  case Question(question: Option[models.Question], random: String)
  case OpenAnswer(answer: String, randon: String)
  case ClosedAnswer(answer: Boolean, randon: String)

  final def kind: Ballot.Kind =
    this match
      case _: Ballot.Question => Ballot.Kind.Question
      case _: OpenAnswer      => Ballot.Kind.Answer(models.Question.Kind.Open)
      case _: ClosedAnswer    => Ballot.Kind.Answer(models.Question.Kind.Closed)

object Ballot:

  enum Kind:
    case Question
    case Answer(kind: models.Question.Kind)

  object Kind:
    given Eq[Kind] = Eq.fromUniversalEquals

  def questions(l: List[Ballot]): List[models.Question] =
    l.collect { case Question(Some(q), _) =>
      q
    }

  def verifyHashes(proposedHashes: List[Base64UrlEncoded], ballots: List[Ballot]): Boolean =
    val realHashes =
      ballots
        .map(Base64UrlEncoded.hashJSON(_))
        .sorted
    proposedHashes.sorted === realHashes

  given ballotEncoder: Encoder[Ballot] with
    def apply(ballot: Ballot): Json =
      ballot match
        case Question(q, random) =>
          Json.obj(
            "tag"      -> "question".asJson,
            "question" -> q.asJson,
            "random"   -> random.asJson
          )
        case OpenAnswer(a, random) =>
          Json.obj(
            "tag"    -> "open_answer".asJson,
            "answer" -> a.asJson,
            "random" -> random.asJson
          )

        case ClosedAnswer(a, random) =>
          Json.obj(
            "tag"    -> "closed_answer".asJson,
            "answer" -> a.asJson,
            "random" -> random.asJson
          )

  given ballotDecoder: Decoder[Ballot] with
    def apply(h: HCursor): Decoder.Result[Ballot] =
      import Decoder.resultInstance.*
      h.downField("tag").as[String].flatMap {
        case "question" =>
          for
            question <- h.downField("question").as[Option[models.Question]]
            random   <- h.downField("random").as[String]
          yield Question(question, random)

        case "open_answer" =>
          for
            answer <- h.downField("answer").as[String]
            random <- h.downField("random").as[String]
          yield OpenAnswer(answer, random)
        case "closed_answer" =>
          for
            answer <- h.downField("answer").as[Boolean]
            random <- h.downField("random").as[String]
          yield ClosedAnswer(answer, random)
        case s =>
          raiseError(DecodingFailure(s"Unknown ballot tag ${s}", Nil))
      }
