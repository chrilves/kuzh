import { Fingerprint } from "../Crypto";
import { MemberAbsent } from "../Member";
import { Question } from "../Question";
import { Status } from "./Status";

export type State = {
  readonly questions: Question[];
  readonly present: Fingerprint[];
  readonly absent: MemberAbsent[];
  readonly status: Status;
};
