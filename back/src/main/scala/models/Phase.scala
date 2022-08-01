package chrilves.kuzh.back.models

import chrilves.kuzh.back.lib.crypto.*
import io.circe.*
import io.circe.syntax.*
import cats.syntax.traverse.*
import cats.instances.list.*
import chrilves.kuzh.back.models.Member.Fingerprint

enum Phase:
  case Hashes(remaining: List[Member.Fingerprint])
  case Verification(
      hashes: Set[Base64UrlEncoded],
      signatures: Map[Member.Fingerprint, Signature[Phase.Proof]]
  )
  case Real(
      hashes: Set[Base64UrlEncoded],
      signatures: Map[Member.Fingerprint, Signature[Phase.Proof]],
      remaining: List[Member.Fingerprint]
  )

object Phase:
  final case class Proof(
      harvest: Harvest,
      hashes: Set[Base64UrlEncoded]
  )

  object Proof:
    given proofEncoder: Encoder[Proof] with
      final def apply(p: Proof): Json =
        Json.obj(
          "harvest" -> p.harvest.asJson,
          "hashes"  -> p.hashes.toList.map(_.asString).sorted.asJson
        )

  given phaseEncoder: Encoder[Phase] with
    final def apply(p: Phase): Json =
      p match
        case Hashes(remaining) =>
          Json.obj(
            "tag"       -> "hashes".asJson,
            "remaining" -> remaining.asJson
          )
        case Verification(hashes, signatures) =>
          Json.obj(
            "tag"    -> "verification".asJson,
            "hashes" -> hashes.toList.map(_.asString).sorted.asJson,
            "signatures" -> signatures.toList.map { case (member, sig) =>
              Json.obj(
                "member"    -> member.asJson,
                "signature" -> sig.asJson
              )
            }.asJson
          )
        case Real(hashes, signatures, remaining) =>
          Json.obj(
            "tag"    -> "real".asJson,
            "hashes" -> hashes.toList.map(_.asString).sorted.asJson,
            "signatures" -> signatures.toList.map { case (member, sig) =>
              Json.obj(
                "member"    -> member.asJson,
                "signature" -> sig.asJson
              )
            }.asJson,
            "remaining" -> remaining.asJson
          )
