package chrilves.kuzh.back.models

import cats.*
import cats.effect.*
import cats.implicits.*
import cats.kernel.Eq
import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.Signed
import chrilves.kuzh.back.lib.crypto.VerifyFun
import io.circe.*
import io.circe.syntax.*

import scala.collection.*
import chrilves.kuzh.back.models.Member.Fingerprint
import java.util.UUID

final case class Harvest(
    id: UUID,
    question: Option[String],
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
        question     <- c.downField("question").as[Option[String]]
        participants <- c.downField("participants").as[List[Fingerprint]].map(_.toSet)
      yield Harvest(id, question, participants)

/*
object Harvest:
  type Signed = String

  enum Result[A,B]:
    case Failed(
      harvest: Harvest[A,B],
      reason: FailureReason[A,B]
    )
    case Success(
      harvest: Harvest[A,B],
      hashes: Set[Secret.Hash],
      validations: Map[Member.Fingerprint, Protocol.Validation.Response[A,B]],
      secrets: Set[Secret[B]]
    )

  enum FailureReason[A,B]:
    case Refused(members: Map[Member.Fingerprint, Protocol.Accept.Response[A,B]])
    case Invalid(members: Map[Member.Fingerprint, Protocol.Validation.Response[A,B]])
    case MembersMissing(member: Set[Member.Fingerprint])
    case ProtocolError(member: Member.Fingerprint)

  enum Protocol[A,B]:
    case Accept(
      harvest: Harvest[A,B],
      consents: Map[Member.Fingerprint, Accept.Response[A,B]]
    )
    case Hash(
      harvest: Harvest[A,B],
      consents: Map[Member.Fingerprint, Accept.Response[A,B]],
      nexts: List[Member.Fingerprint]
    )
    case Validation(
      harvest: Harvest[A,B],
      consents: Map[Member.Fingerprint, Accept.Response[A,B]],
      hashes: Set[Secret.Hash],
      validations: Map[Member.Fingerprint, Validation.Response[A,B]]
    )
    case Parcel(
      harvest: Harvest[A,B],
      hashes: Set[Secret.Hash],
      validations: Map[Member.Fingerprint, Validation.Response[A,B]],
      nexts: List[Member.Fingerprint]
    )
    case Finished(
      result: Harvest.Result[A,B],
      acknowledged: Map[Member.Fingerprint, Finished.Response[A,B]]
    )

  object Protocol:
    object Accept:
      final case class Proof[+A,+B](
        harvest: Harvest[A,B],
        accept: Boolean
      )

      final case class Response[+A,+B](
        accept: Boolean,
        signature: lib.crypto.Signature[Proof[A,B]]
      )

    object Validation:
      final case class Proof[A,B](
        harvest: Harvest[A,B],
        hashes: Set[Secret.Hash],
        accept: Boolean
      )

      final case class Response[A,B](
        accept: Boolean,
        signature: lib.crypto.Signature[Proof[A,B]]
      )

    object Finished:
      final case class Proof[A,B](
        result: Harvest.Result[A,B]
      )

      final case class Response[A,B](
        signature: lib.crypto.Signature[Proof[A,B]]
      )

 */
