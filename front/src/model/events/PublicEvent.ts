import { Member } from "../Member";
import { Fingerprint } from "../Crypto";

export namespace PublicEvent {
  export type QuestionDone = {
    readonly tag: "question_done";
    readonly id: string;
  };

  export type MemberPresence = {
    readonly tag: "member_presence";
    readonly member: Fingerprint;
    readonly presence: Member.Presence;
  };

  export type MemberBlocking = {
    readonly tag: "member_blocking";
    readonly member: Fingerprint;
    readonly blocking: Member.Blockingness;
  };

  export type NewQuestions = {
    readonly tag: "new_questions";
    readonly id: string;
    readonly questions: [string];
  };
}

export type PublicEvent =
  | PublicEvent.MemberPresence
  | PublicEvent.MemberBlocking
  | PublicEvent.QuestionDone
  | PublicEvent.NewQuestions;