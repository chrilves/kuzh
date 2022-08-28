import { PropagateListener } from "../lib/Listener";
import { AppState } from "./AppState";
import { GuestSeat, SeatState } from "./SteatState";

export class RefAppState {
  appState: AppState;

  constructor(appState: AppState) {
    this.appState = appState;
  }

  /////////////////////////////
  // State

  readonly setAppState = (st: AppState) => {
    this.appState = st;
    this.listeners.propagate(st);
  };
  readonly getAppState = () => this.appState;

  /////////////////////////////
  // Listeners

  readonly listeners: PropagateListener<AppState> = new PropagateListener(
    this.getAppState
  );

  ///////////////////////////////
  // Operations

  readonly getHostState = (): SeatState => {
    switch (this.appState.tag) {
      case "seats":
        return this.appState.host.state;
      default:
        throw new Error("Trying to get guest state without guests ...");
    }
  };

  readonly setHostState = (state: SeatState): void => {
    //console.log(`Setting Host state to ${JSON.stringify(state)}`);
    switch (this.appState.tag) {
      case "seats":
        const host = this.appState.host;
        this.setAppState(
          AppState.seats(
            {
              state: state,
              setState: host.setState,
              exit: host.exit,
              reset: host.reset,
            },
            this.appState.guests
          )
        );
        break;
      default:
        throw new Error(
          `Trying to set host state ${JSON.stringify(state)} with no guests ...`
        );
    }
  };

  readonly getGuestState = (guestID: string): SeatState => {
    switch (this.appState.tag) {
      case "seats":
        const item = this.appState.guests.find((x) => x.guestID === guestID);
        if (item) return item.seat.state;
        else throw new Error("Guest not found.");
      default:
        throw new Error("Trying to get guest state without guests ...");
    }
  };

  readonly setGuestState = (guestID: string, state: SeatState): void => {
    //console.log(`Setting guest ${guestID} state to ${JSON.stringify(state)}`);
    switch (this.appState.tag) {
      case "seats":
        const idx = this.appState.guests.findIndex(
          (gs) => gs.guestID === guestID
        );
        if (idx !== -1) {
          const guests = Array.from(this.appState.guests);
          const gs = guests[idx];
          guests[idx] = {
            guestID: gs.guestID,
            seat: {
              state: state,
              setState: gs.seat.setState,
              exit: gs.seat.exit,
              reset: gs.seat.reset,
            },
          };
          this.setAppState(AppState.seats(this.appState.host, guests));
        } else
          throw new Error(
            `Unknown guest ${guestID}. Trying to set state ${JSON.stringify(
              state
            )}`
          );
        break;
      default:
        throw new Error(
          `Trying to set guest ${guestID} state ${JSON.stringify(
            state
          )} with no guests ...`
        );
    }
  };

  readonly deleteGuest = (guestID: string): void => {
    console.log(`Deletion of guest ${guestID}`);
    switch (this.appState.tag) {
      case "seats":
        const idx = this.appState.guests.findIndex(
          (gs) => gs.guestID === guestID
        );
        if (idx !== -1) {
          const guests = Array.from(this.appState.guests);
          const st = guests[idx].seat.state;
          SeatState.stop(st);
          SeatState.removeListener(st);
          guests.splice(idx, 1);
          this.setAppState(AppState.seats(this.appState.host, guests));
        }
        break;
      default:
        throw new Error(`Trying to delete guest with no guests ...`);
    }
  };

  readonly guestFail = (guestId: string, error: string): void => {
    const member = SeatState.member(this.getGuestState(guestId));
    this.setGuestState(
      guestId,
      SeatState.failure(error, member.nickname, member.assembly)
    );
  };

  readonly guests = (): GuestSeat[] => {
    switch (this.appState.tag) {
      case "seats":
        return this.appState.guests;
      case "menu":
        return [];
    }
  };
}
