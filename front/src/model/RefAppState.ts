import { AppState } from "./AppState";
import { GuestSeat, SeatState } from "./SteatState";

export class RefAppState {
  appState: AppState;

  constructor(appState: AppState) {
    this.appState = appState;
  }

  /////////////////////////////
  // Listeners

  private listerners: ((appState: AppState) => void)[] = [];

  readonly addListerner = (l: (appState: AppState) => void) => {
    this.listerners.push(l);
    l(this.appState);
  };

  readonly removeListerner = (l: (appState: AppState) => void) => {
    const idx = this.listerners.findIndex((x) => x === l);
    if (idx !== -1) this.listerners.splice(idx, 1);
  };

  readonly clearListerner = (l: (appState: AppState) => void) => {
    const idx = this.listerners.findIndex((x) => x === l);
    if (idx !== -1) this.listerners.splice(idx, 1);
  };

  readonly update = () => {
    let error = null;
    for (const l of this.listerners)
      try {
        l(this.appState);
      } catch (e) {
        error = e;
        console.log(`RefAppState: error ${e}`);
      }
    if (error) throw error;
  };

  /////////////////////////////
  // Listeners

  readonly setAppState = (st: AppState) => {
    this.appState = st;
    this.update();
  };
  readonly getAppState = () => this.appState;

  ///////////////////////////////
  // Operations

  readonly setHostState = (state: SeatState): void => {
    console.log(`Setting Host state to ${JSON.stringify(state)}`);
    switch (this.appState.tag) {
      case "seats":
        this.setAppState(
          AppState.seats(
            { state: state, reset: this.appState.host.reset },
            this.appState.guests
          )
        );
        break;
      default:
    }
  };

  readonly setGuestState = (guestID: string, state: SeatState): void => {
    console.log(`Setting guest ${guestID} state to ${JSON.stringify(state)}`);
    switch (this.appState.tag) {
      case "seats":
        const newGuests: GuestSeat[] = [];
        for (const gs of this.appState.guests) {
          if (gs.guestID === guestID)
            newGuests.push({
              guestID: guestID,
              seat: {
                reset: gs.seat.reset,
                state: state,
              },
            });
          else newGuests.push(gs);
        }
        this.setAppState(AppState.seats(this.appState.host, newGuests));
        break;
      default:
    }
  };

  readonly deleteGuest = (guestID: string): void => {
    console.log(`Deletion of guest ${guestID}`);
    switch (this.appState.tag) {
      case "seats":
        const newGuests = [];
        for (const gs of this.appState.guests) {
          if (gs.guestID === guestID) SeatState.stop(gs.seat.state);
          else newGuests.push(gs);
        }
        this.setAppState(AppState.seats(this.appState.host, newGuests));
        break;
      default:
    }
  };

  readonly guestFail = (guestId: string, error: string): void =>
    this.setGuestState(guestId, SeatState.failure(error));

  readonly guests = (): GuestSeat[] => {
    switch (this.appState.tag) {
      case "seats":
        return this.appState.guests;
      case "menu":
        return [];
    }
  };
}
