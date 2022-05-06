import { Ballot } from "../Ballot";
import { Signature } from "../Crypto";
import { Member } from "../Member";

export namespace MemberEvent {
  export type Blocking = {
    readonly tag: "blocking";
    readonly blocking: Member.Blockingness;
  };

  export function blocking(b: Member.Blockingness): Blocking {
    return {
      tag: "blocking",
      blocking: b,
    };
  }

  export type Accept = {
    readonly tag: "accept";
  };

  export const accept: Accept = {
    tag: "accept",
  };

  export type Invalid = {
    readonly tag: "invalid";
  };

  export const invalid: Invalid = {
    tag: "invalid",
  };

  export type Harvesting = {
    readonly tag: "harvesting";
    readonly harvesting: HarvestingEvent;
  };

  export function harvesting(harvestingEvent: HarvestingEvent): Harvesting {
    return {
      tag: "harvesting",
      harvesting: harvestingEvent,
    };
  }

  export namespace HarvestingEvent {
    export type NextHash = {
      readonly tag: "next_hash";
      readonly encrypted_hashes: string[];
    };

    export function nextHash(encryptedHashes: string[]): NextHash {
      return {
        tag: "next_hash",
        encrypted_hashes: encryptedHashes,
      };
    }
    export type Hashes = {
      readonly tag: "hashes";
      readonly hashes: string[];
    };

    export function hashes(hs: string[]): Hashes {
      return {
        tag: "hashes",
        hashes: hs,
      };
    }
    export type Valid = {
      readonly tag: "valid";
      readonly signature: Signature;
    };

    export function valid(sig: Signature): Valid {
      return {
        tag: "valid",
        signature: sig,
      };
    }
    export type NextBallot = {
      readonly tag: "next_ballot";
      readonly encrypted_ballots: string[];
    };

    export function nextBallot(encryptedBallots: string[]): NextBallot {
      return {
        tag: "next_ballot",

        encrypted_ballots: encryptedBallots,
      };
    }

    export type Ballots = {
      readonly tag: "ballots";
      readonly ballots: Ballot[];
    };

    export function ballots(blts: Ballot[]): Ballots {
      return {
        tag: "ballots",
        ballots: blts,
      };
    }
  }

  export type HarvestingEvent =
    | HarvestingEvent.NextHash
    | HarvestingEvent.Hashes
    | HarvestingEvent.Valid
    | HarvestingEvent.NextBallot
    | HarvestingEvent.Ballots;
}

export type MemberEvent =
  | MemberEvent.Blocking
  | MemberEvent.Accept
  | MemberEvent.Harvesting
  | MemberEvent.Invalid;
