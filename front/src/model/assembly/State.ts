import { Fingerprint } from "../Crypto";
import { MemberAbsent } from "../Member";
import { Status } from "./Status";

export type State = {
  readonly questions: string[];
  readonly present: Fingerprint[];
  readonly absent: MemberAbsent[];
  readonly status: Status;
};
