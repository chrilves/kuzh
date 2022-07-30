import { Base64URL } from "../lib/Base64URL";
import { Me, Membership, Fingerprint, Serial } from "./Crypto";

export namespace Handshake {
  export type Crententials = {
    tag: "credentials";
    id: string;
    secret: string;
    member: Fingerprint;
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
    tag: "challenge";
    challenge: string;
    identity_proof_needed: boolean;
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
    tag: "challenge_response";
    signature: string;
    identity_proof: Serial.IdentityProof | null;
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
    tag: "error";
    reason: string;
    fatal: boolean;
  };

  export function error(reason: string, fatal: boolean): Error {
    return {
      tag: "error",
      reason: reason,
      fatal: fatal,
    };
  }

  export type Established = {
    tag: "established";
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
