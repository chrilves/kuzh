import { Fingerprint } from "../Crypto";
import { MemberSignature } from "../Member";
import { Ballot as modelBallot } from "../Ballot";

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

  export type Validity = {
    readonly tag: "validity";
    readonly signatures: MemberSignature[];
  };

  export type Ballot = {
    readonly tag: "ballot";
    readonly previous: string[];
    readonly remaining: Fingerprint[];
  };

  export type Ballots = {
    readonly tag: "ballots";
    readonly ballots: modelBallot[];
  };
}

export type ProtocolEvent =
  | ProtocolEvent.Hash
  | ProtocolEvent.Validate
  | ProtocolEvent.Validity
  | ProtocolEvent.Ballot
  | ProtocolEvent.Ballots;
