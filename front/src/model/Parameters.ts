import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Ballot } from "./Ballot";
import { Question } from "./Question";

export namespace Parameters {
  export const kuzhURL = "https://kuzh.cc/";
  export const sourceURL = "https://github.com/chrilves/kuzh";

  export const reconnectDelay = 30000;
  export const minParticipants = 0;

  export const maxTextSize: number = 300;
  export const minRandomStringSize: number = 32;

  export const saltSize = 16;
}
