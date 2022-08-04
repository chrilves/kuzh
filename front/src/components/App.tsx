import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppState, Stateful } from "../model/AppState";
import Assembly from "../model/assembly/Assembly";
import { Membership } from "../model/Crypto";
import { Operation } from "../model/Operation";
import { AssemblyAPI } from "../services/AssemblyAPI";
import { Services } from "../services/Services";
import Menu from "./Menu";
import { v4 as uuidv4 } from "uuid";
import { Nickname } from "./Nickname";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { IdentityProofStore } from "../services/IdentityProofStore";
import { DummyStorageAPI } from "../services/StorageAPI";
import { GuestSeat, SeatState } from "../model/SteatState";
import Seat from "./SeatPage";

export default function App(props: { services: Services }): JSX.Element {
  const [appState, setAppState] = useState<AppState>(AppState.menu);
  const navigate = useNavigate();

  ////////////////////
  // App Operations //
  ////////////////////

  function menu() {
    switch (appState.tag) {
      case "seats":
        SeatState.stop(appState.host.state);
        for (const gs of appState.guests) SeatState.stop(gs.seat.state);
        break;
      default:
    }
    navigate("/");
    setAppState(AppState.menu);
  }

  /////////////////////
  // Host Operations //
  /////////////////////

  function prepare(operation: Operation): Stateful<Promise<void>> {
    return async (
      appState: AppState,
      setAppState: (st: AppState) => void
    ): Promise<void> => {
      setAppState(
        AppState.seats(
          {
            reset: prepare(operation),
            state: SeatState.prepare(operation),
          },
          AppState.guests(appState, setAppState)
        )
      );
      try {
        let membership: Membership = await AssemblyAPI.fold(
          props.services.assemblyAPI
        )(operation);
        await assembly(membership)(appState, setAppState);
      } catch (e) {
        SeatState.setHostState(SeatState.failure(`${e}`))(
          appState,
          setAppState
        );
      }
    };
  }

  function assembly(membership: Membership): Stateful<Promise<void>> {
    return async (
      appState: AppState,
      setAppState: (st: AppState) => void
    ): Promise<void> => {
      const asm = new Assembly(
        props.services.identityProofStoreFactory.identityProofStore(
          membership.assembly
        ),
        props.services.assemblyAPI,
        membership
      );
      setAppState(
        AppState.seats(
          { reset: assembly(membership), state: SeatState.assembly(asm) },
          AppState.guests(appState, setAppState)
        )
      );
      await asm.start();
      navigate(`/assembly/${membership.assembly.id}`);
      props.services.storageAPI.storeNickname(membership.me.nickname);
    };
  }

  //////////////////////
  // Guest Operations //
  //////////////////////

  function addGuest(
    assemblyInfo: AssemblyInfo,
    nickname: string,
    identityProofStore: IdentityProofStore
  ): Stateful<Promise<void>> {
    return async (
      appState: AppState,
      setAppState: (st: AppState) => void
    ): Promise<void> => {
      switch (appState.tag) {
        case "seats":
          const guestID = uuidv4();

          const operation = Operation.join(
            assemblyInfo.id,
            assemblyInfo.secret,
            nickname
          );

          const guestStorageAPI = new DummyStorageAPI();
          guestStorageAPI.storeNickname(nickname);

          const guestAssemblyAPI =
            props.services.assemblyAPIFactory.withStorageAPI(guestStorageAPI);

          const connect = async () => {
            let membership: Membership = await AssemblyAPI.fold(
              guestAssemblyAPI
            )(operation);
            const asm = new Assembly(
              identityProofStore,
              guestAssemblyAPI,
              membership
            );
            SeatState.setGuestState(guestID, SeatState.assembly(asm))(
              appState,
              setAppState
            );
            return await await asm.start();
          };

          const newGuests = Array.from(appState.guests);
          newGuests.push({
            guestID: guestID,
            seat: {
              reset: connect,
              state: SeatState.prepare(operation),
            },
          });
          setAppState(AppState.seats(appState.host, newGuests));

          try {
            await connect();
          } catch (e) {
            SeatState.setGuestState(guestID, SeatState.failure(`${e}`))(
              appState,
              setAppState
            );
          }
      }
    };
  }

  ///////////////
  // Rendering //
  ///////////////

  let page: JSX.Element;

  switch (appState.tag) {
    case "menu":
      page = (
        <Menu
          storageAPI={props.services.storageAPI}
          prepare={(o) => prepare(o)(appState, setAppState)}
          assembly={(m) => assembly(m)(appState,setAppState)}
        />
      );
      break;
    case "seats":
      let addGuestElem: JSX.Element | null;
      switch (appState.host.state.tag) {
        case "assembly":
          const info = appState.host.state.assembly.membership.assembly;
          const ipStore = appState.host.state.assembly.identityProofStore;
          addGuestElem = (
            <AddGuest addGuest={(n) => addGuest(info, n, ipStore)(appState, setAppState)} />
          );
          break;
        default:
          addGuestElem = null;
      }

      page = (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div style={{ display: "auto" }}>
            <Seat
              key="host"
              state={appState.host.state}
              setState={(s) => SeatState.setHostState(s)(appState, setAppState)}
              exit={menu}
              reset={() => appState.host.reset(appState, setAppState)}
            />
            {addGuestElem}
          </div>
          {appState.guests.map((g) => (
            <Seat
              key={g.guestID}
              state={g.seat.state}
              setState={(s) => SeatState.setGuestState(g.guestID, s)(appState, setAppState)}
              exit={() => SeatState.deleteGuest(g.guestID)(appState, setAppState)}
              reset={() => g.seat.reset(appState, setAppState)}
            />
          ))}
        </div>
      );
      break;
  }

  return (
    <div>
      <h1>kuzh</h1>
      {page}
    </div>
  );
}

type AddGuestProps = {
  addGuest: (nickname: string) => Promise<void>;
};

function AddGuest(props: AddGuestProps): JSX.Element {
  const [counter, setCounter] = useState<number>(1);
  const [nickname, setNickname] = useState<string>(`Guest#${counter}`);

  function add() {
    if (validInput()) {
      props.addGuest(nickname);
      setCounter(counter + 1);
      setNickname(`Guest#${counter}`);
    }
  }

  function validInput(): boolean {
    return !!nickname;
  }

  return (
    <div className="kuzh-join-assembly">
      <h3 className="kuzh-style-action">Ajouter Un.e invitée</h3>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={add}>
            Ajouter l'invité.e
          </button>
        </div>
      ) : (
        <p>Pseudo invalide</p>
      )}
    </div>
  );
}