import { Fingerprint } from "../Crypto";

export namespace Phase {
  export type Proposed = {
    readonly tag: "proposed";
    remaining: Fingerprint[];
  };

  export function proposed(remaining: Fingerprint[]): Proposed {
    return {
      tag: "proposed",
      remaining: remaining,
    };
  }

  export type Started = {
    readonly tag: "started";
  };

  export const started: Started = {
    tag: "started",
  };
}

export type Phase = Phase.Proposed | Phase.Started;
