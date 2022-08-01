import { Fingerprint } from "./Crypto";
import { Harvest } from "./Harvest";
import { MemberPresence, MemberReadiness } from "./Member";

export type AssemblyState = {
  questions: string[];
  presences: MemberPresence[];
  status: AssemblyState.Status;
};

export namespace AssemblyState {
  export type Status =
    | Status.Waiting
    | Status.Proposed
    | Status.Harvesting
    | Status.Hidden;

  export namespace Status {
    export type Waiting = {
      readonly tag: "waiting";
      id: string;
      question: string | null;
      ready: MemberReadiness[];
    };

    export function waiting(
      id: string,
      question: string | null,
      ready: MemberReadiness[]
    ): Waiting {
      return {
        tag: "waiting",
        id: id,
        question: question,
        ready: ready,
      };
    }

    export type Proposed = {
      readonly tag: "proposed";
      harvest: Harvest;
      remaining: Fingerprint[];
    };

    export function proposed(
      harvest: Harvest,
      remaining: Fingerprint[]
    ): Proposed {
      return {
        tag: "proposed",
        harvest: harvest,
        remaining: remaining,
      };
    }

    export type Harvesting = {
      readonly tag: "harvesting";
      participants: Fingerprint[];
      phase: any;
    };

    export function harvesting(
      participants: Fingerprint[],
      phase: any
    ): Harvesting {
      return {
        tag: "harvesting",
        participants: participants,
        phase: phase,
      };
    }

    export type Hidden = {
      readonly tag: "hidden";
    };

    export const hidden: Hidden = {
      tag: "hidden",
    };
  }
}
