import { Fingerprint } from "./Crypto";

export type AssemblyState = {
  questions: string[];
  presences: MemberPresence[];
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

export type MemberReadiness = {
  member: Fingerprint;
  readiness: Member.Readiness;
};

export type MemberPresence = {
  member: Fingerprint;
  presence: Member.Presence;
};

export namespace Member {
  export type Readiness = "busy" | "ready";

  export type Presence = Presence.Absent | Presence.Present;

  export namespace Presence {
    export type Absent = {
      readonly tag: "absent";
      since: number;
    };

    export function absent(since: number): Absent {
      return {
        tag: "absent",
        since: since,
      };
    }

    export type Present = {
      readonly tag: "present";
    };

    export const present: Present = {
      tag: "present",
    };
  }
}
