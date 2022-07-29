import { Base64URL } from "../lib/Base64URL";
import {
  CryptoMe,
  CryptoMembership,
  Fingerprint,
  IdentityProof,
} from "./Crypto";

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
    identity_proof: IdentityProof | null;
  };

  export function challengeResponse(
    signature: string,
    identityProof: IdentityProof | null
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
    cryptoMembership: CryptoMembership,
    challenge: Challenge
  ): Promise<ChallengeResponse> {
    const signature = await CryptoMe.signB64(
      cryptoMembership.me,
      Base64URL.getInstance().decode(challenge.challenge)
    );
    let identityProof: IdentityProof | null;

    if (challenge.identity_proof_needed) {
      identityProof = await CryptoMe.identityProof(cryptoMembership.me);
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
