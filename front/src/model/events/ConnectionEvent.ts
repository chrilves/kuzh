import { State } from "../assembly/State";

export namespace ConnectionEvent {
  export type Opened = {
    readonly tag: "opened";
  };

  export const opened: Opened = {
    tag: "opened",
  };

  export type Closed = {
    readonly tag: "closed";
  };

  export const closed: Closed = {
    tag: "closed",
  };

  export type Error = {
    readonly tag: "error";
    readonly error: string;
    readonly fatal: boolean;
  };

  export function error(r: string, fatal: boolean): Error {
    return {
      tag: "error",
      error: r,
      fatal: fatal,
    };
  }

  export type Established = {
    readonly tag: "established";
    readonly state: State;
  };

  export function established(state: State): Established {
    return {
      tag: "established",
      state: state,
    };
  }
}

export type ConnectionEvent =
  | ConnectionEvent.Opened
  | ConnectionEvent.Closed
  | ConnectionEvent.Established
  | ConnectionEvent.Error;
