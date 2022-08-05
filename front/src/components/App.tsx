import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppState } from "../model/AppState";
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
import { SeatState } from "../model/SteatState";
import Seat from "./SeatPage";
import { RefAppState } from "../model/RefAppState";

export default function App(props: {
  services: Services;
  refAppState: RefAppState;
}): JSX.Element {
  const [_, setAppState] = useState<AppState>(props.refAppState.appState);
  const navigate = useNavigate();

  useEffect(() => {
    props.refAppState.addListerner(setAppState);
    return () => props.refAppState.removeListerner(setAppState);
  }, []);

  ////////////////////
  // App Operations //
  ////////////////////

  function menu() {
    switch (props.refAppState.appState.tag) {
      case "seats":
        SeatState.stop(props.refAppState.appState.host.state);
        for (const gs of props.refAppState.appState.guests)
          SeatState.stop(gs.seat.state);
        break;
      default:
    }
    navigate("/");
    props.refAppState.setAppState(AppState.menu);
  }

  /////////////////////
  // Host Operations //
  /////////////////////

  async function prepare(operation: Operation): Promise<void> {
    props.refAppState.setAppState(
      AppState.seats(
        {
          reset: () => prepare(operation),
          state: SeatState.prepare(operation),
        },
        props.refAppState.guests()
      )
    );
    try {
      let membership: Membership = await AssemblyAPI.fold(
        props.services.assemblyAPI
      )(operation);
      await assembly(membership);
    } catch (e) {
      props.refAppState.setHostState(SeatState.failure(`${e}`));
    }
  }

  async function assembly(membership: Membership): Promise<void> {
    const asm = new Assembly(
      props.services.identityProofStoreFactory.identityProofStore(
        membership.assembly
      ),
      props.services.assemblyAPI,
      membership
    );

    props.refAppState.setAppState(
      AppState.seats(
        { reset: asm.restart, state: SeatState.assembly(asm) },
        props.refAppState.guests()
      )
    );
    await asm.start();
    navigate(`/assembly/${membership.assembly.id}`);
    props.services.storageAPI.storeNickname(membership.me.nickname);
  }

  //////////////////////
  // Guest Operations //
  //////////////////////

  async function addGuest(
    assemblyInfo: AssemblyInfo,
    nickname: string,
    identityProofStore: IdentityProofStore
  ): Promise<void> {
    switch (props.refAppState.appState.tag) {
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
          let membership: Membership = await AssemblyAPI.fold(guestAssemblyAPI)(
            operation
          );
          const asm = new Assembly(
            identityProofStore,
            guestAssemblyAPI,
            membership
          );
          props.refAppState.setGuestState(guestID, SeatState.assembly(asm));
          return await await asm.start();
        };

        const newGuests = Array.from(props.refAppState.guests());
        newGuests.push({
          guestID: guestID,
          seat: {
            reset: connect,
            state: SeatState.prepare(operation),
          },
        });
        props.refAppState.setAppState(
          AppState.seats(props.refAppState.appState.host, newGuests)
        );

        try {
          await connect();
        } catch (e) {
          props.refAppState.setGuestState(guestID, SeatState.failure(`${e}`));
        }
    }
  }

  ///////////////
  // Rendering //
  ///////////////

  let page: JSX.Element;

  switch (props.refAppState.appState.tag) {
    case "menu":
      page = (
        <Menu
          storageAPI={props.services.storageAPI}
          prepare={prepare}
          assembly={assembly}
        />
      );
      break;
    case "seats":
      let addGuestElem: JSX.Element | null;
      switch (props.refAppState.appState.host.state.tag) {
        case "assembly":
          const info =
            props.refAppState.appState.host.state.assembly.membership.assembly;
          const ipStore =
            props.refAppState.appState.host.state.assembly.identityProofStore;
          addGuestElem = (
            <AddGuest
              addGuest={(n) => addGuest(info, n, ipStore)}
              hostNickname={
                props.refAppState.appState.host.state.assembly.membership.me
                  .nickname
              }
            />
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
              state={props.refAppState.appState.host.state}
              setState={props.refAppState.setHostState}
              exit={menu}
              reset={props.refAppState.appState.host.reset}
            />
            {addGuestElem}
          </div>
          {props.refAppState.appState.guests.map((g) => (
            <Seat
              key={g.guestID}
              state={g.seat.state}
              setState={(s) => props.refAppState.setGuestState(g.guestID, s)}
              exit={() => props.refAppState.deleteGuest(g.guestID)}
              reset={g.seat.reset}
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
  hostNickname: string;
};

function AddGuest(props: AddGuestProps): JSX.Element {
  const [counter, setCounter] = useState<number>(1);
  const [nickname, setNickname] = useState<string>(
    `${props.hostNickname}#${counter}`
  );

  function add() {
    if (validInput()) {
      props.addGuest(nickname);
      setCounter(counter + 1);
      setNickname(`${props.hostNickname}#${counter + 1}`);
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
