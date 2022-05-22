import { Member, PublicState } from "./AssemblyState";
import { Fingerprint } from "./Crypto";

export type Event =
  | Event.QuestionDone
  | Event.NewQuestions
  | Event.MemberUpdate
  | Event.StatusUpdate;

export namespace Event {
  export type QuestionDone = {
    readonly tag: "question_done";
  };

  export type NewQuestions = {
    readonly tag: "new_questions";
    questions: [string];
  };

  export type MemberUpdate = {
    readonly tag: "member_update";
    member: Fingerprint;
    presence: Member.Presence;
    ready: Member.Readiness;
  };

  export type StatusUpdate = {
    readonly tag: "status_update";
    status: PublicState.Status;
  };
}

export type AssemblyEvent =
  | AssemblyEvent.PublicSynchro
  | AssemblyEvent.PublicEvent;

export namespace AssemblyEvent {
  export type PublicSynchro = {
    readonly tag: "public_state";
    public_state: PublicState;
  };

  export function publicSynchro(publicState: PublicState): PublicSynchro {
    return {
      tag: "public_state",
      public_state: publicState,
    };
  }

  export type PublicEvent = {
    readonly tag: "public_event";
    public_event: Event;
  };

  export function publicEvent(publicEvent: Event): PublicEvent {
    return {
      tag: "public_event",
      public_event: publicEvent,
    };
  }
}
