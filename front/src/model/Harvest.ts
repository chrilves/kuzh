import { Fingerprint } from "./Crypto";

export type Harvest = {
  readonly id: string;
  readonly question: string | null;
  readonly participants: Fingerprint[];
};
