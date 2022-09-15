import { GetSet, ObservableVar } from "../lib/Var";
import { AppState } from "./AppState";
import { GuestSeat, SeatState } from "./SteatState";

export class RefAppState {
  readonly appState: ObservableVar<AppState>;

  constructor(appState: AppState) {
    this.appState = ObservableVar.fromGetSet(GetSet.variable(appState));
  }

  ///////////////////////////////
  // Operations

  readonly getHostState = (): SeatState => {
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        return st.host.state;
      default:
        throw new Error("Trying to get guest state without guests ...");
    }
  };

  readonly setHostState = (state: SeatState): void => {
    // State Debugging
    //console.log(`Setting Host state to ${JSON.stringify(state)}`);
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        const host = st.host;
        this.appState.set(
          AppState.seats(
            {
              state: state,
              setState: host.setState,
              exit: host.exit,
              reset: host.reset,
            },
            st.guests
          )
        );
        break;
      default:
        throw new Error(
          `Trying to set host state ${JSON.stringify(state)} with no guests ...`
        );
    }
  };

  readonly hostState = GetSet.getterSetter<SeatState>(
    this.getHostState,
    this.setHostState
  );

  readonly getGuestState = (guestID: string): SeatState => {
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        const item = st.guests.find((x) => x.guestID === guestID);
        if (item) return item.seat.state;
        else throw new Error("Guest not found.");
      default:
        throw new Error("Trying to get guest state without guests ...");
    }
  };

  readonly setGuestState = (guestID: string, state: SeatState): void => {
    // State Debugging
    //console.log(`Setting guest ${guestID} state to ${JSON.stringify(state)}`);
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        const idx = st.guests.findIndex((gs) => gs.guestID === guestID);
        if (idx !== -1) {
          const guests = Array.from(st.guests);
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
          this.appState.set(AppState.seats(st.host, guests));
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

  readonly guestState = (guestID: string) =>
    GetSet.getterSetter<SeatState>(
      () => this.getGuestState(guestID),
      (state: SeatState) => this.setGuestState(guestID, state)
    );

  readonly deleteGuest = (guestID: string): void => {
    console.log(`Deletion of guest ${guestID}`);
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        const idx = st.guests.findIndex((gs) => gs.guestID === guestID);
        if (idx !== -1) {
          const guests = Array.from(st.guests);
          const stg = guests[idx].seat.state;
          SeatState.stop(stg);
          SeatState.removeListener(stg);
          guests.splice(idx, 1);
          this.appState.set(AppState.seats(st.host, guests));
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
    const st = this.appState.get();
    switch (st.tag) {
      case "seats":
        return st.guests;
      case "menu":
        return [];
    }
  };
}
