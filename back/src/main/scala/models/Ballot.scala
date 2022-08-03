package chrilves.kuzh.back.models

import io.circe.*
import io.circe.syntax.*

enum Ballot:
  case Question(question: Option[String], random: String)
  case Answer(answer: Boolean, randon: String)

object Ballot:
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
