import { Member } from "./Member";
import { Fingerprint } from "./Crypto";
import { AssemblyState } from "./AssemblyState";

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
