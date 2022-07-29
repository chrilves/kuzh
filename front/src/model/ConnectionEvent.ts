export namespace ConnectionEvent {
  export type Opened = {
    tag: "opened";
  };

  export const opened: Opened = {
    tag: "opened",
  };

  export type Closed = {
    tag: "closed";
  };

  export const closed: Closed = {
    tag: "closed",
  };

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

  export type Established = {
    tag: "established";
  };

  export const established: Established = {
    tag: "established",
  };
}

export type ConnectionEvent =
  | ConnectionEvent.Opened
  | ConnectionEvent.Closed
  | ConnectionEvent.Established
  | ConnectionEvent.Error;
