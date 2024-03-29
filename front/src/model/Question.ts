export type Question = {
  readonly message: string;
  readonly kind: Question.Kind;
};

export namespace Question {
  export type Kind = "open" | "closed";

  export function apply(message: string, kind: Kind): Question {
    return {
      message,
      kind,
    };
  }

  export function kindText(kind: Kind): string {
    switch (kind) {
      case "closed":
        return "closed-ended";
      case "open":
        return "open-ended";
    }
  }
}
