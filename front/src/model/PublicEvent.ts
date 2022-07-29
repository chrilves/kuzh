import { Member, AssemblyState } from "./AssemblyState";
import { Fingerprint } from "./Crypto";

export type PublicEvent =
  | PublicEvent.QuestionDone
  | PublicEvent.NewQuestions
  | PublicEvent.MemberPresence
  | PublicEvent.MemberReady
  | PublicEvent.StatusUpdate;

export namespace PublicEvent {
  export type QuestionDone = {
    readonly tag: "question_done";
  };

  export type NewQuestions = {
    readonly tag: "new_questions";
    questions: [string];
  };

  export type MemberPresence = {
    readonly tag: "member_presence";
    member: Fingerprint;
    presence: Member.Presence;
  };

  export type MemberReady = {
    readonly tag: "member_ready";
    member: Fingerprint;
  };

  export type StatusUpdate = {
    readonly tag: "status_update";
    status: AssemblyState.Status;
  };
}

export type AssemblyEvent = AssemblyEvent.StateW | AssemblyEvent.PublicEventW;

export namespace AssemblyEvent {
  export type StateW = {
    readonly tag: "state";
    state: AssemblyState;
  };

  export function publicSynchro(state: AssemblyState): StateW {
    return {
      tag: "state",
      state: state,
    };
  }

  export type PublicEventW = {
    readonly tag: "public_event";
    public_event: PublicEvent;
  };

  export function publicEvent(publicEvent: PublicEvent): PublicEventW {
    return {
      tag: "public_event",
      public_event: publicEvent,
    };
  }
}
