import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { checkListEqual } from "../lib/Utils";
import { Fingerprint } from "./Crypto";
import { Question as ModelQuestion } from "./Question";

export namespace HarvestResult {
  export type Question = {
    tag: "question";
    participants: Fingerprint[];
    questions: ModelQuestion[];
  };

  export function questions(
    participants: Fingerprint[],
    qs: ModelQuestion[]
  ): Question {
    return {
      tag: "question",
      participants: participants,
      questions: qs,
    };
  }

  export type ClosedAnswer = {
    tag: "closed_answer";
    participants: Fingerprint[];
    question: string;
    yes: number;
    no: number;
  };

  export function closedAnswer(
    participants: Fingerprint[],
    question: string,
    yes: number,
    no: number
  ): ClosedAnswer {
    return {
      tag: "closed_answer",
      participants: participants,
      question: question,
      yes: yes,
      no: no,
    };
  }

  export type OpenAnswer = {
    tag: "open_answer";
    participants: Fingerprint[];
    question: string;
    answers: string[];
  };

  export function openAnswer(
    participants: Fingerprint[],
    question: string,
    answers: string[]
  ): OpenAnswer {
    return {
      tag: "open_answer",
      question: question,
      participants: participants,
      answers: answers,
    };
  }

  export function checkSameQuestions(
    harvestResult: HarvestResult,
    questions: ModelQuestion[]
  ): void {
    if (harvestResult.tag === "question")
      if (
        !checkListEqual(
          harvestResult.questions.map(JSONNormalizedStringifyD),
          questions.map(JSONNormalizedStringifyD)
        )
      )
        throw new Error(
          `Harvest questions ${JSON.stringify(
            harvestResult.questions
          )} and server questions ${JSON.stringify(
            questions
          )} are not the same!`
        );
  }
}

export type HarvestResult =
  | HarvestResult.Question
  | HarvestResult.ClosedAnswer
  | HarvestResult.OpenAnswer;
