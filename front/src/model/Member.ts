import { Fingerprint, Signature } from "./Crypto";

export type MemberReadiness = {
  readonly member: Fingerprint;
  readiness: Member.Readiness;
};

export type MemberAbsent = {
  readonly member: Fingerprint;
  readonly since: number;
};

export type MemberSignature = {
  readonly member: Fingerprint;
  readonly signature: Signature;
};

export namespace Member {
  export type Blockingness = "blocking" | "ready";
  export type Readiness = "answering" | Blockingness;

  export type Presence = Presence.Absent | Presence.Present;

  export namespace Presence {
    export type Absent = {
      readonly tag: "absent";
      readonly since: number;
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
