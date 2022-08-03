import { Base64URL } from "../lib/Base64URL";
import { Me, Membership, Fingerprint, Serial } from "./Crypto";

export namespace Handshake {
  export type Crententials = {
    readonly tag: "credentials";
    readonly id: string;
    readonly secret: string;
    readonly member: Fingerprint;
  };

  export function credentials(
    id: string,
    secret: string,
    member: Fingerprint
  ): Crententials {
    return {
      tag: "credentials",
      id: id,
      secret: secret,
      member: member,
    };
  }

  export type Challenge = {
    readonly tag: "challenge";
    readonly challenge: string;
    readonly identity_proof_needed: boolean;
  };

  export function challenge(
    challenge: string,
    identity_proof_needed: boolean
  ): Challenge {
    return {
      tag: "challenge",
      challenge: challenge,
      identity_proof_needed: identity_proof_needed,
    };
  }

  export type ChallengeResponse = {
    readonly tag: "challenge_response";
    readonly signature: string;
    readonly identity_proof: Serial.IdentityProof | null;
  };

  export function challengeResponse(
    signature: string,
    identityProof: Serial.IdentityProof | null
  ): ChallengeResponse {
    return {
      tag: "challenge_response",
      signature: signature,
      identity_proof: identityProof,
    };
  }

  export type Error = {
    readonly tag: "error";
    readonly reason: string;
    readonly fatal: boolean;
  };

  export function error(reason: string, fatal: boolean): Error {
    return {
      tag: "error",
      reason: reason,
      fatal: fatal,
    };
  }

  export type Established = {
    readonly tag: "established";
  };

  export const established: Established = {
    tag: "established",
  };

  export async function replyToChallenge(
    membership: Membership,
    challenge: Challenge
  ): Promise<ChallengeResponse> {
    const signature = await membership.me.signB64(
      Base64URL.getInstance().decode(challenge.challenge)
    );
    let identityProof: Serial.IdentityProof | null;

    if (challenge.identity_proof_needed) {
      const ip = await membership.me.identityProof();
      identityProof = await ip.toJson();
    } else {
      identityProof = null;
    }

    return challengeResponse(signature, identityProof);
  }
}

export type Handshake =
  | Handshake.Crententials
  | Handshake.Challenge
  | Handshake.ChallengeResponse
  | Handshake.Error
  | Handshake.Established;
