import { Member } from "./Member";
import { Fingerprint } from "./Crypto";

export namespace PublicEvent {
  export type QuestionDone = {
    readonly tag: "question_done";
    readonly id: string;
  };

  export type NewQuestions = {
    readonly tag: "new_questions";
    readonly id: string;
    readonly questions: [string];
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

  export type HarvestAccepted = {
    readonly tag: "harvest_accepted";
    member: Fingerprint;
  };
}

export type PublicEvent =
  | PublicEvent.QuestionDone
  | PublicEvent.NewQuestions
  | PublicEvent.MemberPresence
  | PublicEvent.MemberBlocking
  | PublicEvent.HarvestAccepted;
