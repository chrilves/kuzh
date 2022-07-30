export namespace MemberEvent {
  export type Ready = {
    tag: "ready";
  };

  export const ready: Ready = {
    tag: "ready",
  };
}

export type MemberEvent = MemberEvent.Ready;
