package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*
import cats.syntax.eq.*

import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.models.Ballot.BallotType
import cats.kernel.Eq

enum Ballot:
  case Question(question: Option[String], random: String)
  case Answer(answer: Boolean, randon: String)

  final def tpe: BallotType =
    this match
      case _: Question => BallotType.Question
      case _: Answer   => BallotType.Answer

object Ballot:

  enum BallotType:
    case Question, Answer

  object BallotType:
    given Eq[BallotType] = Eq.fromUniversalEquals

  def questions(l: List[Ballot]): List[String] =
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
        case Answer(a, random) =>
          Json.obj(
            "tag"    -> "answer".asJson,
            "answer" -> a.asJson,
            "random" -> random.asJson
          )

  given ballotDecoder: Decoder[Ballot] with
    def apply(h: HCursor): Decoder.Result[Ballot] =
      import Decoder.resultInstance.*
      h.downField("tag").as[String].flatMap {
        case "question" =>
          for
            question <- h.downField("question").as[Option[String]]
            random   <- h.downField("random").as[String]
          yield Question(question, random)

        case "answer" =>
          for
            answer <- h.downField("answer").as[Boolean]
            random <- h.downField("random").as[String]
          yield Answer(answer, random)
        case s =>
          raiseError(DecodingFailure(s"Unknown ballot tag ${s}", Nil))
      }
