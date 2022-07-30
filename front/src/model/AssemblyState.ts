import { Fingerprint } from "./Crypto";
import { MemberPresence, MemberReadiness } from "./Member";

export type AssemblyState = {
  questions: string[];
  presences: MemberPresence[];
  id: string;
  status: AssemblyState.Status;
};

export namespace AssemblyState {
  export type Status = Status.Waiting | Status.Harvesting;

  export namespace Status {
    export type Waiting = {
      readonly tag: "waiting";
      question: string | null;
      ready: MemberReadiness[];
    };

    export function waiting(
      question: string | null,
      ready: MemberReadiness[]
    ): Waiting {
      return {
        tag: "waiting",
        question: question,
        ready: ready,
      };
    }

    export type Harvesting = {
      readonly tag: "harvesting";
      type: HarvestType;
      members: Fingerprint[];
    };

    export function harvesting(
      type: HarvestType,
      members: Fingerprint[]
    ): Harvesting {
      return {
        tag: "harvesting",
        type: type,
        members: members,
      };
    }

    export type HarvestType = "questions" | "answers";
  }
}
