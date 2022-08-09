import { Fingerprint } from "../Crypto";
import { Question } from "../Question";

export type Harvest = {
  readonly id: string;
  readonly question: Question | null;
  readonly participants: Fingerprint[];
};

export namespace Harvest {
  export type Kind = "question" | "closed_answer" | "open_answer";

  export function kind(harvest: Harvest): Kind {
    if (harvest.question === null) return "question";

    switch (harvest.question.kind) {
      case "open":
        return "open_answer";
      case "closed":
        return "closed_answer";
    }
  }
}
