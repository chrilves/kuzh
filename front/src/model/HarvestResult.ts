import { checkListEqual } from "../lib/Utils";

export namespace HarvestResult {
  export type Question = {
    tag: "question";
    questions: string[];
  };

  export function questions(qs: string[]): Question {
    return {
      tag: "question",
      questions: qs,
    };
  }

  export type Answer = {
    tag: "answer";
    yes: number;
    no: number;
  };

  export function answer(yes: number, no: number): Answer {
    return {
      tag: "answer",
      yes: yes,
      no: no,
    };
  }

  export function checkSameQuestions(
    harvestResult: HarvestResult,
    questions: string[]
  ): void {
    if (harvestResult.tag === "question")
      if (!checkListEqual(harvestResult.questions, questions))
        throw new Error(
          `Harvest questions ${JSON.stringify(
            harvestResult.questions
          )} and server questions ${JSON.stringify(
            questions
          )} are not the same!`
        );
  }
}

export type HarvestResult = HarvestResult.Question | HarvestResult.Answer;
