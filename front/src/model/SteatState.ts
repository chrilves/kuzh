import { Operation } from "./Operation";
import * as AssemblyModel from "./assembly/Assembly";

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
    readonly error: any;
    readonly nickname: string;
    readonly assembly: AssemblyModel.default | null;
  };

  export function failure(
    error: any,
    nickname: string,
    assembly: AssemblyModel.default | null
  ): Failure {
    return {
      tag: "failure",
      error: error,
      nickname: nickname,
      assembly: assembly,
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
        console.log(
          `[${state.assembly.membership.me.nickname}] Stopping assembly.`
        );
        state.assembly.stop();
        break;
      default:
    }
  }

  export function member(st: SeatState): {
    nickname: string;
    assembly: AssemblyModel.default | null;
  } {
    switch (st.tag) {
      case "prepare":
        return {
          nickname: st.operation.nickname,
          assembly: null,
        };
      case "assembly":
        return {
          nickname: st.assembly.membership.me.nickname,
          assembly: st.assembly,
        };
      case "failure":
        return {
          nickname: st.nickname,
          assembly: st.assembly,
        };
    }
  }

  export function removeListener(st: SeatState): void {
    const m = member(st);
    if (m.assembly) {
      console.log(
        `[${m.assembly.membership.me.nickname}] Removing all listeners.`
      );
      m.assembly.seatListeners.clearListeners();
      m.assembly.connectionStatusListener.clearListeners();
      m.assembly.stateListener().clearListeners();
      m.assembly.harvestResultListener().clearListeners();
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
  readonly state: SeatState;
  readonly setState: (st: SeatState) => void;
  readonly exit: () => void;
  readonly reset: () => Promise<void>;
};
