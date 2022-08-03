import { Member } from "../Member";

export namespace ChoiceStatus {
  export type NoChoice = {
    readonly tag: "no_choice";
  };

  export const noChoice: NoChoice = {
    tag: "no_choice",
  };

  export type Question = {
    readonly tag: "question";
    readonly id: string;
    readonly question: string | null;
    readonly blocking: Member.Blockingness;
  };

  export function question(
    id: string,
    q: string | null,
    b: Member.Blockingness
  ): Question {
    return {
      tag: "question",
      id: id,
      question: q,
      blocking: b,
    };
  }

  export type Answser = {
    readonly tag: "answer";
    readonly id: string;
    readonly answer: boolean;
    readonly blocking: Member.Blockingness;
  };

  export function answer(
    id: string,
    answer: boolean,
    b: Member.Blockingness
  ): Answser {
    return {
      tag: "answer",
      id: id,
      answer: answer,
      blocking: b,
    };
  }
}

export type ChoiceStatus =
  | ChoiceStatus.NoChoice
  | ChoiceStatus.Question
  | ChoiceStatus.Answser;
