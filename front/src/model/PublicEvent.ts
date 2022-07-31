import { Member } from "./Member";
import { Fingerprint } from "./Crypto";
import { AssemblyState } from "./AssemblyState";

export type PublicEvent =
  | PublicEvent.QuestionDone
  | PublicEvent.NewQuestions
  | PublicEvent.MemberPresence
  | PublicEvent.MemberBlocking
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

  export type MemberBlocking = {
    readonly tag: "member_blocking";
    member: Fingerprint;
    blocking: Member.Blockingness;
  };

  export type StatusUpdate = {
    readonly tag: "status_update";
    status: AssemblyState.Status;
  };
}
