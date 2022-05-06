import { Base64URL } from "../lib/Base64URL";
import { AssemblyInfo } from "./assembly/AssembyInfo";
import { State } from "./assembly/State";
import { Membership, Fingerprint, Serial } from "./Crypto";

export namespace Handshake {
  export namespace In {
    export type Challenge = {
      readonly tag: "challenge";
      readonly challenge: string;
      readonly identity_proof_needed: boolean;
    };

    export type Error = {
      readonly tag: "error";
      readonly error: string;
      readonly fatal: boolean;
    };

    export type Established = {
      readonly tag: "established";
      readonly state: State;
    };
  }

  export type In = In.Challenge | In.Error | In.Established;

  export namespace Out {
    export type Crententials = {
      readonly tag: "credentials";
      readonly assembly: AssemblyInfo;
      readonly member: Fingerprint;
    };

    export function credentials(
      assembly: AssemblyInfo,
      member: Fingerprint
    ): Crententials {
      return {
        tag: "credentials",
        assembly: assembly,
        member: member,
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
  }

  export type Out = Out.Crententials | Out.ChallengeResponse;

  export async function replyToChallenge(
    membership: Membership,
    challenge: In.Challenge
  ): Promise<Out.ChallengeResponse> {
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

    return Out.challengeResponse(signature, identityProof);
  }
}
