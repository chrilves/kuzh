import { AssemblyState } from "./AssemblyState";
import { PublicEvent } from "./PublicEvent";

export namespace AssemblyEvent {
  export type StateW = {
    readonly tag: "state";
    state: AssemblyState;
  };

  export function stateW(state: AssemblyState): StateW {
    return {
      tag: "state",
      state: state,
    };
  }

  export type StatusW = {
    readonly tag: "status";
    status: AssemblyState.Status;
  };

  export function statusW(status: AssemblyState.Status): StatusW {
    return {
      tag: "status",
      status: status,
    };
  }

  export type PublicEventW = {
    readonly tag: "public_event";
    public_event: PublicEvent;
  };

  export function publicEvent(publicEvent: PublicEvent): PublicEventW {
    return {
      tag: "public_event",
      public_event: publicEvent,
    };
  }

  export type Error = {
    tag: "error";
    reason: string;
    fatal: boolean;
  };

  export function error(reason: string, fatal: boolean): Error {
    return {
      tag: "error",
      reason: reason,
      fatal: fatal,
    };
  }
}

export type AssemblyEvent =
  | AssemblyEvent.StateW
  | AssemblyEvent.StatusW
  | AssemblyEvent.PublicEventW
  | AssemblyEvent.Error;
