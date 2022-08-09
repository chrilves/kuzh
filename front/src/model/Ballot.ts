import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { CryptoUtils } from "./Crypto";
import { Parameters } from "./Parameters";
import { Question as ModelQuestion } from "./Question";

export namespace Ballot {
  export type Question = {
    tag: "question";
    question: ModelQuestion | null;
    random: string;
  };

  const minQuestionBallot: Ballot.Question = {
    tag: "question",
    question: ModelQuestion.apply("", "closed"),
    random: "",
  };

  const maxBallotQuestionSize: number =
    Parameters.maxTextSize +
    Parameters.minRandomStringSize +
    JSONNormalizedStringifyD(minQuestionBallot).length;

  export function question(question: ModelQuestion | null): Question {
    let ballot: Question = {
      tag: "question",
      question: question,
      random: "",
    };

    let randomLength =
      maxBallotQuestionSize - JSONNormalizedStringifyD(ballot).length;
    if (randomLength >= Parameters.minRandomStringSize) {
      ballot.random = CryptoUtils.randomString(randomLength);
      if (JSONNormalizedStringifyD(ballot).length === maxBallotQuestionSize)
        return ballot;
      else throw new Error("Can not forge a valid question ballot.");
    } else throw new Error("Question too large!");
  }

  export type ClosedAnswer = {
    tag: "closed_answer";
    answer: boolean;
    random: string;
  };

  const minClosedAnswerBallot: Ballot.ClosedAnswer = {
    tag: "closed_answer",
    answer: false,
    random: "",
  };

  const maxBallotClosedAnswerSize: number =
    Parameters.minRandomStringSize +
    JSONNormalizedStringifyD(minClosedAnswerBallot).length;

  export function closedAnswer(answer: boolean): ClosedAnswer {
    let ballot: ClosedAnswer = {
      tag: "closed_answer",
      answer: answer,
      random: "",
    };

    let randomLength =
      maxBallotClosedAnswerSize - JSONNormalizedStringifyD(ballot).length;
    if (randomLength >= Parameters.minRandomStringSize) {
      ballot.random = CryptoUtils.randomString(randomLength);
      if (JSONNormalizedStringifyD(ballot).length === maxBallotClosedAnswerSize)
        return ballot;
      else throw new Error("Can not forge a valid closed answer ballot.");
    } else throw new Error("Closed answer too large!");
  }

  export type OpenAnswer = {
    tag: "open_answer";
    answer: string;
    random: string;
  };

  const minOpenAnswerBallot: Ballot.OpenAnswer = {
    tag: "open_answer",
    answer: "",
    random: "",
  };

  const maxBallotOpenAnswerSize: number =
    Parameters.maxTextSize +
    Parameters.minRandomStringSize +
    JSONNormalizedStringifyD(minOpenAnswerBallot).length;

  export function openAnswer(answer: string): OpenAnswer {
    let ballot: OpenAnswer = {
      tag: "open_answer",
      answer: answer,
      random: "",
    };

    let randomLength =
      maxBallotOpenAnswerSize - JSONNormalizedStringifyD(ballot).length;
    if (randomLength >= Parameters.minRandomStringSize) {
      ballot.random = CryptoUtils.randomString(randomLength);
      if (JSONNormalizedStringifyD(ballot).length === maxBallotOpenAnswerSize)
        return ballot;
      else throw new Error("Can not forge a valid open answer ballot.");
    } else throw new Error("Open answer too large!");
  }
}

export type Ballot = Ballot.Question | Ballot.OpenAnswer | Ballot.ClosedAnswer;
