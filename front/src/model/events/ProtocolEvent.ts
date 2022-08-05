import { Fingerprint } from "../Crypto";

export namespace ProtocolEvent {
  export type Hash = {
    readonly tag: "hash";
    readonly previous: string[];
    readonly remaining: Fingerprint[];
  };

  export type Validate = {
    readonly tag: "validate";
    readonly hashes: string[];
  };

  export type Real = {
    readonly tag: "real";
    readonly previous: string[];
    readonly remaining: Fingerprint[];
  };
}

export type ProtocolEvent =
  | ProtocolEvent.Hash
  | ProtocolEvent.Validate
  | ProtocolEvent.Real;
