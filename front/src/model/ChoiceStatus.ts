export namespace ChoiceStatus {
  export type NoChoice = {
    tag: "no_choice";
  };

  export const noChoice: NoChoice = {
    tag: "no_choice",
  };

  export type Question = {
    tag: "question";
    question: string | null;
  };

  export function question(q: string | null): Question {
    return {
      tag: "question",
      question: q,
    };
  }

  export type Answser = {
    tag: "answer";
    answer: boolean;
  };

  export function answer(answer: boolean): Answser {
    return {
      tag: "answer",
      answer: answer,
    };
  }
}

export type ChoiceStatus =
  | ChoiceStatus.NoChoice
  | ChoiceStatus.Question
  | ChoiceStatus.Answser;
