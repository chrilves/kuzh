export namespace ChoiceStatus {
  export type NoChoice = {
    tag: "no_choice";
  };

  export const noChoice: NoChoice = {
    tag: "no_choice",
  };

  export type Question = {
    tag: "question";
    id: string;
    question: string | null;
  };

  export function question(id: string, q: string | null): Question {
    return {
      tag: "question",
      id: id,
      question: q,
    };
  }

  export type Answser = {
    tag: "answer";
    id: string;
    answer: boolean;
  };

  export function answer(id: string, answer: boolean): Answser {
    return {
      tag: "answer",
      id: id,
      answer: answer,
    };
  }
}

export type ChoiceStatus =
  | ChoiceStatus.NoChoice
  | ChoiceStatus.Question
  | ChoiceStatus.Answser;
