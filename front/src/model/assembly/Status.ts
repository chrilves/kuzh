import { MemberReadiness } from "../Member";
import { Harvest } from "./Harvest";
import { Phase } from "./Phase";

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

  export type Harvesting = {
    readonly tag: "harvesting";
    harvest: Harvest;
    phase: Phase;
  };

  export function harvesting(harvest: Harvest, phase: Phase): Harvesting {
    return {
      tag: "harvesting",
      harvest: harvest,
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

export type Status = Status.Waiting | Status.Harvesting | Status.Hidden;
