import { Fingerprint } from "../Crypto";

namespace HarvestingEvent {
  export type Accepted = {
    readonly tag: "accepted";
    readonly member: Fingerprint;
  };

  export type Refused = {
    readonly tag: "refused";
    readonly member: Fingerprint;
  };

  export type Invalid = {
    readonly tag: "invalid";
  };
}

export type HarvestingEvent =
  | HarvestingEvent.Accepted
  | HarvestingEvent.Refused
  | HarvestingEvent.Invalid;
