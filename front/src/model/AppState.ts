import { GuestSeat, Seat } from "./SteatState";

export namespace AppState {
  export type Menu = {
    readonly tag: "menu";
  };

  export const menu: Menu = {
    tag: "menu",
  };

  export type Seats = {
    readonly tag: "seats";
    readonly host: Seat;
    readonly guests: GuestSeat[];
  };

  export function seats(host: Seat, guests: GuestSeat[]): Seats {
    return {
      tag: "seats",
      host: host,
      guests: guests,
    };
  }

  export const guests: Stateful<GuestSeat[]> = (
    appState: AppState,
    setAppState: (st: AppState) => void
  ) => {
    switch (appState.tag) {
      case "seats":
        return appState.guests;
      case "menu":
        return [];
    }
  };
}

export type AppState = AppState.Menu | AppState.Seats;

export type Stateful<A> = (
  appState: AppState,
  setAppState: (appState: AppState) => void
) => A;
