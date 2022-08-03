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

  export type AcceptHarvest = {
    readonly tag: "accept_harvest";
  };

  export const acceptHarvest: AcceptHarvest = {
    tag: "accept_harvest",
  };
}

export type MemberEvent = MemberEvent.Blocking | MemberEvent.AcceptHarvest;
