import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { CryptoUtils } from "./Crypto";
import { Parameters } from "./Parameters";

export namespace Ballot {
  export type Question = {
    tag: "question";
    question: string | null;
    random: string;
  };

  export function question(question: string | null): Question {
    let ballot: Question = {
      tag: "question",
      question: question,
      random: "",
    };

    let randomLength = Parameters.ballotQuestionSize - JSONNormalizedStringifyD(ballot).length;
    if (randomLength <= Parameters.minRandomStringSize) {
      ballot.random = CryptoUtils.randomString(randomLength);
      if (JSONNormalizedStringifyD(ballot).length === Parameters.ballotQuestionSize) {
        console.log(`ballot=${JSONNormalizedStringifyD(ballot)}`);
        return ballot;
      }
      else
        throw new Error("Can not forge a valid ballot.")
    } else
        throw new Error("Question too large!")
  }

  export type Answer = {
    tag: "answer";
    answer: boolean;
    random: string;
  };

  export function answer(answer: boolean): Answer {
    let ballot: Answer = {
      tag: "answer",
      answer: answer,
      random: "",
    };

    let randomLength = Parameters.ballotAnswerSize - JSONNormalizedStringifyD(ballot).length;
    if (randomLength <= Parameters.minRandomStringSize) {
      ballot.random = CryptoUtils.randomString(randomLength);
      if (JSONNormalizedStringifyD(ballot).length === Parameters.ballotAnswerSize) {
        console.log(`ballot=${JSONNormalizedStringifyD(ballot)}`);
        return ballot;
      }
      else
        throw new Error("Can not forge a valid ballot.")
    } else
        throw new Error("Question too large!")
  }
}

export type Ballot = Ballot.Question | Ballot.Answer;
