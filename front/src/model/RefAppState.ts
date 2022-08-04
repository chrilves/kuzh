import { AppState } from "./AppState"

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
  }
  
  readonly removeListerner = (l: (appState: AppState) => void) => {
    const idx = this.listerners.findIndex((x) => x === l);
    if (idx !== -1) this.listerners.splice(idx, 1);
  }

  readonly clearListerner = (l: (appState: AppState) => void) => {
    const idx = this.listerners.findIndex((x) => x === l);
    if (idx !== -1) this.listerners.splice(idx, 1);
  }

  readonly update = () => {
    let error = null;
    for (const l of this.listerners)
      try {
        l(this.appState);
      }
      catch (e) {
        error =e ;
        console.log(`RefAppState: error ${e}`);
      }
    if (error)
      throw error
  }

  /////////////////////////////
  // Listeners

  readonly setAppState = (st: AppState) => this.appState = st;
  readonly getAppState = () => this.appState;
  

  ///////////////////////////////
  // Operations

  export function setHostState(state: SeatState): Stateful<void> {
    return (appState: AppState, setAppState: (st: AppState) => void): void => {
      console.log(`Setting Host state to ${JSON.stringify(state)}`);
      switch (appState.tag) {
        case "seats":
          setAppState(
            AppState.seats(
              { state: state, reset: appState.host.reset },
              appState.guests
            )
          );
          break;
        default:
      }
    };
  }

  export function setGuestState(
    guestID: string,
    state: SeatState
  ): Stateful<void> {
    return (appState: AppState, setAppState: (st: AppState) => void): void => {
      console.log(`Setting guest ${guestID} state to ${JSON.stringify(state)}`);
      switch (appState.tag) {
        case "seats":
          const newGuests: GuestSeat[] = [];
          for (const gs of appState.guests) {
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
          setAppState(AppState.seats(appState.host, newGuests));
          break;
        default:
      }
    };
  }

  export function deleteGuest(guestID: string): Stateful<void> {
    return (appState: AppState, setAppState: (st: AppState) => void): void => {
      console.log(`Deletion of guest ${guestID}`);
      switch (appState.tag) {
        case "seats":
          const newGuests = [];
          for (const gs of appState.guests) {
            if (gs.guestID === guestID) SeatState.stop(gs.seat.state);
            else newGuests.push(gs);
          }
          setAppState(AppState.seats(appState.host, newGuests));
          break;
        default:
      }
    };
  }

  export function guestFail(guestId: string, error: string): Stateful<void> {
    return (appState: AppState, setAppState: (st: AppState) => void): void => {
      setGuestState(guestId, SeatState.failure(error))(appState, setAppState);
    };
  }

}