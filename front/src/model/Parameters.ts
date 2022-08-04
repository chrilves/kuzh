import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Ballot } from "./Ballot";

export namespace Parameters {
  const minQuestionBallot: Ballot.Question = {
    tag: "question",
    question: "",
    random: "",
  };

  const minAnswerBallot: Ballot.Answer = {
    tag: "answer",
    answer: false,
    random: "",
  };

  export const maxQuestionSize: number = 300;
  export const minRandomStringSize: number = 12;
  export const ballotQuestionSize: number =
    maxQuestionSize +
    minRandomStringSize +
    JSONNormalizedStringifyD(minQuestionBallot).length;
  export const ballotAnswerSize: number =
    minRandomStringSize + JSONNormalizedStringifyD(minAnswerBallot).length;
}
