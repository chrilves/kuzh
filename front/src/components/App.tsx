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
import { QRCodeSVG } from "qrcode.react";
import { Parameters } from "../model/Parameters";

export default function App(props: {
  services: Services;
  refAppState: RefAppState;
}): JSX.Element {
  const [_, setAppState] = useState<AppState>(props.refAppState.appState);
  const navigate = useNavigate();

  useEffect(() => {
    props.refAppState.listerners.addListener(setAppState);
    return () => props.refAppState.listerners.removeListener(setAppState);
  }, [props.refAppState]);

  ////////////////////
  // App Operations //
  ////////////////////

  function menu() {
    switch (props.refAppState.appState.tag) {
      case "seats":
        SeatState.stop(props.refAppState.appState.host.state);
        SeatState.removeListerner(props.refAppState.appState.host.state);
        for (const gs of props.refAppState.appState.guests) {
          SeatState.stop(gs.seat.state);
          SeatState.removeListerner(gs.seat.state);
        }
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
          state: SeatState.prepare(operation),
          setState: props.refAppState.setHostState,
          exit: menu,
          reset: () => prepare(operation),
        },
        props.refAppState.guests()
      )
    );

    let asm: Assembly | null = null;

    try {
      let membership: Membership = await AssemblyAPI.fold(
        props.services.assemblyAPI
      )(operation);
      asm = await assembly(membership);
    } catch (e) {
      props.refAppState.setHostState(
        SeatState.failure(JSON.stringify(e), operation.nickname, asm)
      );
    }
  }

  async function assembly(membership: Membership): Promise<Assembly> {
    const asm = new Assembly(
      props.services.identityProofStoreFactory.identityProofStore(
        membership.assembly
      ),
      props.services.assemblyAPI,
      membership,
      props.refAppState.getHostState
    );

    props.refAppState.setAppState(
      AppState.seats(
        {
          state: SeatState.assembly(asm),
          setState: props.refAppState.setHostState,
          exit: menu,
          reset: asm.restart,
        },
        props.refAppState.guests()
      )
    );
    asm.seatListeners.addListener(props.refAppState.setHostState);
    await asm.start();
    navigate(`/assembly/${membership.assembly.id}`);
    props.services.storageAPI.storeNickname(membership.me.nickname);
    return asm;
  }

  //////////////////////
  // Guest Operations //
  //////////////////////

  async function addGuest(
    assemblyInfo: AssemblyInfo,
    nickname: string,
    identityProofStore: IdentityProofStore
  ): Promise<void> {
    if (props.refAppState.appState.tag === "seats") {
      const guestID = uuidv4();

      const operation = Operation.join(
        assemblyInfo.id,
        assemblyInfo.name,
        assemblyInfo.secret,
        nickname
      );

      const guestStorageAPI = new DummyStorageAPI();
      guestStorageAPI.storeNickname(nickname);

      const guestAssemblyAPI =
        props.services.assemblyAPIFactory.withStorageAPI(guestStorageAPI);

      let asm: Assembly | null = null;

      const connect = async () => {
        if (props.refAppState.appState.tag === "seats") {
          let membership: Membership = await AssemblyAPI.fold(guestAssemblyAPI)(
            operation
          );

          asm = new Assembly(
            identityProofStore,
            guestAssemblyAPI,
            membership,
            () => props.refAppState.getGuestState(guestID)
          );

          const idx = props.refAppState.appState.guests.findIndex(
            (gs) => gs.guestID === guestID
          );
          if (idx !== -1) {
            const newGuests = Array.from(props.refAppState.appState.guests);
            const gs = newGuests[idx];
            newGuests[idx] = {
              guestID: guestID,
              seat: {
                state: SeatState.assembly(asm),
                setState: gs.seat.setState,
                exit: gs.seat.exit,
                reset: asm.restart,
              },
            };

            asm.seatListeners.addListener(gs.seat.setState);

            props.refAppState.setAppState(
              AppState.seats(props.refAppState.appState.host, newGuests)
            );
          }

          return asm.start();
        } else throw new Error("Trying to connect a guest not in seat mode");
      };

      const newGuests = Array.from(props.refAppState.appState.guests);

      newGuests.push({
        guestID: guestID,
        seat: {
          state: SeatState.prepare(operation),
          setState: (s) => props.refAppState.setGuestState(guestID, s),
          reset: connect,
          exit: () => props.refAppState.deleteGuest(guestID),
        },
      });
      props.refAppState.setAppState(
        AppState.seats(props.refAppState.appState.host, newGuests)
      );

      try {
        await connect();
      } catch (e) {
        props.refAppState.setGuestState(
          guestID,
          SeatState.failure(JSON.stringify(e), nickname, asm)
        );
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
            <div key={g.guestID} style={{ display: "auto" }}>
              <Seat
                state={g.seat.state}
                setState={g.seat.setState}
                exit={g.seat.exit}
                reset={g.seat.reset}
              />
            </div>
          ))}
        </div>
      );
      break;
  }

  return (
    <div>
      <KuzhTitle />
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
      <h2 className="kuzh-style-action">Ajouter Un.e invitée</h2>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div style={{ paddingBottom: "10%" }}>
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

function KuzhTitle(): JSX.Element {
  const urlIntoClipboard = () =>
    navigator.clipboard.writeText(Parameters.kuzhURL);

  return (
    <header>
      <h1 onClick={urlIntoClipboard}>
        <QRCodeSVG
          value={Parameters.kuzhURL}
          size={25}
          includeMargin={false}
          style={{ paddingLeft: "5px", paddingRight: "5px" }}
        />
        kuzh.cc : questions/réponses anonymes, et{" "}
        <a href={Parameters.sourceURL} target="_blank">
          open-source
        </a>
        !
      </h1>
    </header>
  );
}
