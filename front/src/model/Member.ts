import { Fingerprint } from "./Crypto";

export type MemberReadiness = {
  member: Fingerprint;
  readiness: Member.Readiness;
};

export type MemberPresence = {
  member: Fingerprint;
  presence: Member.Presence;
};

export namespace Member {
  export type Blockingness = "blocking" | "ready";
  export type Readiness = "answering" | Blockingness;

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
