package chrilves.kuzh.back.models

import chrilves.kuzh.back.lib.crypto.*
import io.circe.*
import io.circe.syntax.*
import cats.syntax.traverse.*
import cats.instances.list.*
import scala.collection.*
import chrilves.kuzh.back.models.Member.Fingerprint

enum HarvestProtocol:
  case Hashes(remaining: List[Member.Fingerprint])
  case Verification(
      hashes: List[Base64UrlEncoded],
      signatures: immutable.Map[Member.Fingerprint, Signature[HarvestProtocol.Proof]]
  )
  case Reals(
      hashes: List[Base64UrlEncoded],
      signatures: immutable.Map[Member.Fingerprint, Signature[HarvestProtocol.Proof]],
      remaining: List[Member.Fingerprint]
  )

object HarvestProtocol:
  final case class Proof(
      harvest: Harvest,
      hashes: List[Base64UrlEncoded]
  )

  object Proof:
    given proofEncoder: Encoder[Proof] with
      final def apply(p: Proof): Json =
        Json.obj(
          "harvest" -> p.harvest.asJson,
          "hashes"  -> p.hashes.toList.map(_.asString).sorted.asJson
        )

  enum Event:
    case Hash(previous: List[Base64UrlEncoded], remaining: List[Member.Fingerprint])
    case Validate(hashes: List[Base64UrlEncoded])
    case Validity(signatures: Map[Member.Fingerprint, Signature[HarvestProtocol.Proof]])
    case Real(previous: List[Base64UrlEncoded], remaining: List[Member.Fingerprint])
    case Result(ballots: List[Ballot])

  object Event:
    given harvestProtocolEventEncoder: Encoder[Event] with
      final def apply(e: Event): Json =
        e match
          case Hash(previous, remaining) =>
            Json.obj(
              "tag"       -> "hash".asJson,
              "previous"  -> previous.map(_.asString).sorted.asJson,
              "remaining" -> remaining.asJson
            )
          case Validate(hashes) =>
            Json.obj(
              "tag"    -> "validate".asJson,
              "hashes" -> hashes.toList.map(_.asString).sorted.asJson
            )
          case Validity(signatures) =>
            Json.obj(
              "tag" -> "validity".asJson,
              "signatures" -> signatures.toList.map { case (k, v) =>
                Json.obj(
                  "member"    -> k.asJson,
                  "signature" -> v.asJson
                )
              }.asJson
            )
          case Real(previous, remaining) =>
            Json.obj(
              "tag"       -> "real".asJson,
              "previous"  -> previous.map(_.asString).sorted.asJson,
              "remaining" -> remaining.asJson
            )
          case Result(ballots) =>
            Json.obj(
              "tag"     -> "result".asJson,
              "ballots" -> ballots.asJson
            )
