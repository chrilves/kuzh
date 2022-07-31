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
}

export type MemberEvent = MemberEvent.Blocking;
