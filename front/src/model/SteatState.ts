import { Operation } from "./Operation";
import * as AssemblyModel from "./assembly/Assembly";
import { AppState, Stateful } from "./AppState";

export namespace SeatState {
  export type Prepare = {
    readonly tag: "prepare";
    readonly operation: Operation;
  };

  export function prepare(Operation: Operation): Prepare {
    return {
      tag: "prepare",
      operation: Operation,
    };
  }

  export type Failure = {
    readonly tag: "failure";
    readonly error: string;
  };

  export function failure(error: string): Failure {
    return {
      tag: "failure",
      error: error,
    };
  }

  export type Assembly = {
    readonly tag: "assembly";
    readonly assembly: AssemblyModel.default;
  };

  export function assembly(assembly: AssemblyModel.default): Assembly {
    return {
      tag: "assembly",
      assembly: assembly,
    };
  }

  export function stop(state: SeatState) {
    switch (state.tag) {
      case "assembly":
        state.assembly.stop();
        break;
      default:
    }
  }
}

export type SeatState =
  | SeatState.Prepare
  | SeatState.Failure
  | SeatState.Assembly;

export type GuestSeat = {
  readonly guestID: string;
  readonly seat: Seat;
};

export type Seat = {
  readonly reset: Stateful<Promise<void>>;
  readonly state: SeatState;
};
