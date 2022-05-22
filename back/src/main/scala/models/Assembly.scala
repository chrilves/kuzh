package chrilves.kuzh.back.models

import cats.*
import cats.effect.*
import cats.implicits.*
import cats.implicits.*
import cats.instances.StringInstances
import cats.kernel.Eq
import chrilves.kuzh.back.*
import chrilves.kuzh.back.lib.crypto.Signed
import chrilves.kuzh.back.lib.crypto.VerifyFun
import chrilves.kuzh.back.lib.crypto.*
import chrilves.kuzh.back.models.Assembly.*
import chrilves.kuzh.back.services.IdentityProofStore
import io.circe.*
import io.circe.generic.auto.*
import io.circe.syntax.*
import org.http4s.Header.Single
import org.http4s.*
import org.http4s.circe.*
import org.typelevel.ci.*

import java.time.Instant
import java.util.UUID
import scala.collection.*
import scala.concurrent.duration.FiniteDuration

/* ASSUMPTIONS:

   Member.Fingerprint => member identity proof registered!
 */
trait Assembly[F[_]]:
  def info: Assembly.Info
  def state: F[Assembly.PublicState]

  def registerMember(id: IdentityProof): F[Unit]
  def identityProofs(ids: Set[Member.Fingerprint]): F[List[IdentityProof]]
  def memberReady(member: Member.Fingerprint, ready: Member.Readiness): F[Unit]
  def memberPresence(member: Member.Fingerprint, presence: Member.Presence): F[Unit]
  def memberChannel(
      member: Member.Fingerprint,
      handler: AssemblyEvent => F[Unit]
  ): F[Unit]

  inline final def memberMessage(member: Member.Fingerprint, message: MemberEvent): F[Unit] =
    import MemberEvent.*
    message match
      case Readiness(r) => memberReady(member, r)

object Assembly:

  final case class Info(
      id: Info.Id,
      name: Info.Name,
      secret: Info.Secret
  )

  object Info:
    opaque type Id = java.util.UUID

    object Id:
      inline def random[F[_]: Sync]: F[Id] =
        Sync[F].delay(java.util.UUID.randomUUID())

      inline def fromUUID(uuid: java.util.UUID): Id =
        uuid

      inline given Encoder[Id] = lib.StringInstances.encoder.contramap[java.util.UUID](_.toString())
      inline given Decoder[Id] = lib.StringInstances.decoder.map(java.util.UUID.fromString)
      inline given Eq[Secret]  = Eq.fromUniversalEquals

    opaque type Name = String

    object Name:
      given nameEntityDecoder[F[_]: Concurrent]: EntityDecoder[F, Name] =
        jsonOf[F, Name]

      inline given Encoder[Name] = lib.StringInstances.encoder
      inline given Decoder[Name] = lib.StringInstances.decoder
      inline given Eq[Name]      = lib.StringInstances.eq

    opaque type Secret = String

    object Secret:
      given secretHeader: Header[Secret, Single] =
        Header.create(
          ci"X-KUZH-ASSEMBLY-SECRET",
          x => x,
          Right(_)
        )

      inline given Encoder[Secret] = lib.StringInstances.encoder
      inline given Decoder[Secret] = lib.StringInstances.decoder
      inline given Eq[Secret]      = lib.StringInstances.eq

      inline def random[F[_]: Sync]: F[Secret] =
        lib.Random.bytes(32).map { arr =>
          Base64UrlEncoded.encode(arr).asString
        }

    given assemblyInfoEncoder: Encoder[Assembly.Info] with
      final def apply(i: Assembly.Info): Json = Json.obj(
        "uuid"   -> i.id.asJson,
        "name"   -> i.name.asJson,
        "secret" -> i.secret.asJson
      )

  final case class PublicState(
      questions: List[String],
      presences: Map[Member.Fingerprint, Member.Presence],
      status: PublicState.Status
  ):
    def question: Option[String] = questions.headOption

  object PublicState:
    val init: PublicState = PublicState(
      questions = Nil,
      presences = Map.empty,
      status = Status.Waiting(None, Map.empty)
    )

    given publicStateEncoder: Encoder[PublicState] with
      final def apply(ps: PublicState): Json =
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

    enum HarvestType:
      case Questions, Answers

    object HarvestType:
      given harvestingTypeEncoder: Encoder[HarvestType] with
        final def apply(ht: HarvestType): Json =
          ht match
            case Questions => Json.fromString("questions")
            case Answers   => Json.fromString("answers")

    enum Status:
      case Waiting(question: Option[String], ready: Map[Member.Fingerprint, Member.Readiness])
      case Harvesting(tpe: HarvestType, mmebers: Set[Member.Fingerprint])

    object Status:
      given statusEncoder: Encoder[Status] with
        final def apply(s: Status): Json =
          s match
            case Waiting(questionOpt, ready) =>
              Json.obj(
                "tag" -> Json.fromString("waiting"),
                "ready" -> Json.fromValues(ready.map { case (fp, r) =>
                  Json.obj(
                    "member"    -> fp.asJson,
                    "readiness" -> r.asJson,
                    "question"  -> questionOpt.asJson
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
      case QuestionDone
      case NewQuestions(questions: List[String])
      case MemberUpdate(
          member: Member.Fingerprint,
          presence: Member.Presence,
          readiness: Member.Readiness
      )
      case StatusUpdate(status: Status)

    object Event:
      given AssemblyEventEncoder: Encoder[Event] with
        final def apply(e: Event): Json =
          e match
            case QuestionDone =>
              Json.obj(
                "tag" -> Json.fromString("question_done")
              )
            case NewQuestions(ql) =>
              Json.obj(
                "tag"       -> Json.fromString("new_questions"),
                "questions" -> Json.fromValues(ql.map(Json.fromString))
              )
            case MemberUpdate(fp, p, r) =>
              Json.obj(
                "tag"       -> Json.fromString("member_update"),
                "member"    -> fp.asJson,
                "presence"  -> p.asJson,
                "readiness" -> r.asJson
              )
            case StatusUpdate(s) =>
              Json.obj(
                "tag"    -> Json.fromString("status_update"),
                "status" -> s.asJson
              )

  enum AssemblyEvent:
    case PublicSynchro(public: PublicState)
    case PublicEvent(public: PublicState.Event)

  object AssemblyEvent:
    given assemblyEventEncoder: Encoder[AssemblyEvent] with
      final def apply(i: AssemblyEvent): Json =
        i match
          case PublicSynchro(p) =>
            Json.obj(
              "tag"          -> Json.fromString("public_state"),
              "public_state" -> p.asJson
            )
          case PublicEvent(p) =>
            Json.obj(
              "tag"          -> Json.fromString("public_event"),
              "public_event" -> p.asJson
            )

  enum MemberEvent:
    case Readiness(readiness: Member.Readiness)

  object MemberEvent:
    given memberEventEncoder: Encoder[MemberEvent] with
      final def apply(m: MemberEvent): Json =
        m match
          case Readiness(r) =>
            Json.obj(
              "tag"   -> Json.fromString("readiness"),
              "value" -> r.asJson
            )

    given messageFromMemberDecoder: Decoder[MemberEvent] with
      def apply(c: HCursor): Decoder.Result[MemberEvent] =
        c.downField("tag").as[String].flatMap {
          case "readiness" =>
            c.downField("value").as[Member.Readiness].map(MemberEvent.Readiness.apply)
          case s =>
            Decoder.resultInstance
              .raiseError(DecodingFailure(s"Invalid message from member tag '$s'.", Nil))
        }

  inline def inMemory[F[_]: Sync](assemblyInfo: Assembly.Info, deleteMe: F[Unit]): Assembly[F] =
    new Assembly[F]:
      private val idStore: IdentityProofStore[F] =
        IdentityProofStore.inMemory[F]

      private val presence                = mutable.Map.empty[Member.Fingerprint, Member.Presence]
      private var questions: List[String] = Nil
      private var status: PublicState.Status = PublicState.Status.Waiting(None, Map.empty)

      private val channels =
        mutable.Map.empty[Member.Fingerprint, Assembly.AssemblyEvent => F[Unit]]

      val info: Assembly.Info = assemblyInfo

      def state: F[Assembly.PublicState] =
        Sync[F].delay(
          PublicState(
            questions = questions,
            presences = presence.toMap,
            status = status
          )
        )

      def registerMember(id: IdentityProof): F[Unit] =
        idStore.store(id) *> Sync[F].delay {
          presence.addOne(id.fingerprint -> Member.Presence.Present)

          import PublicState.Status.*
          status match
            case Waiting(q, readiness) =>
              status = Waiting(q, readiness ++ Seq(id.fingerprint -> Member.Readiness.Busy))
            case _ =>
              ()
        }

      def identityProofs(ids: Set[Member.Fingerprint]): F[List[IdentityProof]] =
        idStore.fetch(ids)

      def memberReady(member: Member.Fingerprint, ready: Member.Readiness): F[Unit] =
        Sync[F].delay {
          import PublicState.Status.*
          status match
            case Waiting(q, readiness) =>
              status = Waiting(q, readiness ++ Seq(member -> ready))
            case _ =>
              ()
        }

      def memberPresence(member: Member.Fingerprint, pres: Member.Presence): F[Unit] =
        Sync[F].delay {
          presence.addOne(member -> pres)
        }

      def memberChannel(
          member: Member.Fingerprint,
          handler: Assembly.AssemblyEvent => F[Unit]
      ): F[Unit] =
        Sync[F].delay {
          channels.addOne(member -> handler)
        } *> state.flatMap(st => handler(AssemblyEvent.PublicSynchro(st)))
