package chrilves.kuzhback.models

import cats.Applicative
import cats.implicits.*
import io.circe.{Encoder, Json}

object Assembly:
  enum Harvest[A]:
    val path: List[Member.Fingerprint]

    case Question(path: List[Member.Fingerprint])                 extends Harvest[String]
    case Answer(question: String, path: List[Member.Fingerprint]) extends Harvest[Boolean]

  object Harvest:
    opaque type Signed = String

    enum ValidationOk[A]:
      val signature: Harvest.Signed

      case Question(signature: Harvest.Signed)               extends ValidationOk[String]
      case Answer(forecast: Long, signature: Harvest.Signed) extends ValidationOk[Boolean]

    final case class Result[A](
        harvest: Harvest[A],
        hashes: Set[Secret.Hash],
        validations: Map[Member.Fingerprint, ValidationOk[A]],
        value: Set[Secret[A]]
    )

  enum Secret[A]:
    val random: String

    case Question(value: String, random: String) extends Secret[String]
    case Answer(value: Boolean, random: String)  extends Secret[Boolean]

  object Secret:
    opaque type Hash = String

  object Harvesting:
    enum FailureReason:
      case Refused(members: Set[Member.Fingerprint])
      case Invalid(members: Set[Member.Fingerprint])
      case MembersMissing(member: Set[Member.Fingerprint])
      case ProtocolError(member: Member.Fingerprint)

    enum Phase[A]:
      case Accept(
          harvest: Harvest[A],
          consents: Map[Member.Fingerprint, Harvest.Signed]
      )
      case Hash(
          harvest: Harvest[A],
          consents: Map[Member.Fingerprint, Harvest.Signed],
          nexts: List[Member.Fingerprint]
      )
      case Validation[A](
          harvest: Harvest[A],
          hashes: Set[Secret.Hash],
          validations: Map[Member.Fingerprint, Harvest.ValidationOk[A]]
      ) extends Phase[A]
      case Response(
          harvest: Harvest[A],
          hashes: Set[Secret.Hash],
          validations: Map[Member.Fingerprint, Harvest.ValidationOk[A]],
          nexts: List[Member.Fingerprint]
      ) extends Phase[A]
      case Failed(reason: FailureReason)
      case Closing[A](
          result: Harvest.Result[A],
          waiting: Set[Member.Fingerprint]
      ) extends Phase[A]

  enum WaitingStatus:
    case Budy, Ready

  enum Status:
    case Waiting(members: Map[Member.Fingerprint, WaitingStatus])
    case HarvestingQuestions(phase: Assembly.Harvesting.Phase[String])
    case HarvestingAnswers(phase: Assembly.Harvesting.Phase[Boolean])

  final case class State(
      questions: List[String],
      members: Map[Member.Fingerprint, Member.Presence],
      scores: Map[Member.Fingerprint, Long],
      status: Status
  ):
    def question: Option[String] = questions.headOption

object Member:
  opaque type Name        = String
  opaque type PK          = String
  opaque type Fingerprint = String

  extension (publicKey: PK) def fingerprint: Fingerprint = ???

  enum Presence:
    case Absent, Present

  final case class Info(
    name: Name,
    score: Long,
    presence: Presence
  )

object MemberChannel:
  enum Connection:
    case Initial
    case ChallengeSent(publicKey: Member.PK, challenge: String)
    case Verified(publicKey: Member.PK)
