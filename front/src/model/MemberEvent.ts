import { Member } from "./Member";

export namespace MemberEvent {
  export type Blocking = {
    tag: "blocking";
    blocking: Member.Blockingness;
  };

  export function blocking(b: Member.Blockingness): Blocking {
    return {
      tag: "blocking",
      blocking: b,
    };
  }

  export type AcceptHarvest = {
    tag: "accept_harvest";
  };

  export const acceptHarvest: AcceptHarvest = {
    tag: "accept_harvest",
  };
}

export type MemberEvent = MemberEvent.Blocking | MemberEvent.AcceptHarvest;
