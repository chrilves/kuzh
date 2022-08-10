import { Question } from "./model/Question";

export namespace French {
  export function questionKind(k: Question.Kind): string {
    if (k === "closed") return "fermée";
    else return "ouverte";
  }
}
