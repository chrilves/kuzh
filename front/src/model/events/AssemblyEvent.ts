import { State } from "../assembly/State";
import { PublicEvent } from "./PublicEvent";
import { Status } from "../assembly/Status";
import { HarvestingEvent } from "./HarvestingEvent";
import { ProtocolEvent } from "./ProtocolEvent";

export namespace AssemblyEvent {
  export type StateW = {
    readonly tag: "state";
    readonly state: State;
  };

  export type StatusW = {
    readonly tag: "status";
    readonly status: Status;
  };

  export type Public = {
    readonly tag: "public";
    readonly public: PublicEvent;
  };

  export type Harvesting = {
    readonly tag: "harvesting";
    readonly harvesting: HarvestingEvent;
  };

  export type Protocol = {
    readonly tag: "protocol";
    readonly protocol: ProtocolEvent;
  };

  export type Error = {
    readonly tag: "error";
    readonly error: string;
    readonly fatal: boolean;
  };
}

export type AssemblyEvent =
  | AssemblyEvent.StateW
  | AssemblyEvent.StatusW
  | AssemblyEvent.Public
  | AssemblyEvent.Harvesting
  | AssemblyEvent.Protocol
  | AssemblyEvent.Error;
