import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { AppState } from "../model/AppState";
import Assembly from "../model/assembly/Assembly";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { Membership } from "../model/Crypto";
import { Operation } from "../model/Operation";
import { Parameters } from "../model/Parameters";
import { RefAppState } from "../model/RefAppState";
import { SeatState } from "../model/SteatState";
import { AssemblyAPI } from "../services/AssemblyAPI";
import { IdentityProofStore } from "../services/IdentityProofStore";
import { Services } from "../services/Services";
import { DummyStorageAPI } from "../services/StorageAPI";
import { useTranslation } from "react-i18next";
import Menu from "./Menu";
import Seat from "./SeatPage";
import Install from "../services/Install";

export default function App(props: {
  services: Services;
  refAppState: RefAppState;
}): JSX.Element {
  const [_, setAppState] = useState<AppState>(props.refAppState.appState);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

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
        } else throw new Error(t("ERROR_CONNECT_GUEST_NO_SEAT_MODE"));
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
      page = (
        <main className="seats">
          <Seat
            key="host"
            state={props.refAppState.appState.host.state}
            setState={props.refAppState.setHostState}
            exit={menu}
            reset={props.refAppState.appState.host.reset}
            addGuest={addGuest}
          />
          {props.refAppState.appState.guests.map((g) => (
            <Seat
              key={g.guestID}
              state={g.seat.state}
              setState={g.seat.setState}
              exit={g.seat.exit}
              reset={g.seat.reset}
              addGuest={addGuest}
            />
          ))}
        </main>
      );
      break;
  }

  return (
    <div>
      <KuzhTitle install={props.services.install} />
      {page}
    </div>
  );
}

function KuzhTitle(props: { install: Install }): JSX.Element {
  const { t, i18n } = useTranslation();
  const [installable, setInstallable] = useState(props.install.installable());

  useEffect(() => {
    props.install.listerners.addListener(setInstallable);
    return () => props.install.listerners.removeListener(setInstallable);
  });

  const urlIntoClipboard = () =>
    navigator.clipboard.writeText(Parameters.kuzhURL);

  return (
    <header id="title">
      <h1 onClick={urlIntoClipboard}>
        <QRCodeSVG value={Parameters.kuzhURL} includeMargin={false} />
        kuzh.cc
        <span>
          <img
            alt="fr"
            className="language-flag"
            src="/flags/fr.svg"
            onClick={() => i18n.changeLanguage("fr")}
          />
          <img
            alt="en"
            className="language-flag"
            src="/flags/en.svg"
            onClick={() => i18n.changeLanguage("en")}
          />
        </span>
      </h1>
      {t("Anonymous Questions and Answers")}, {t("in")}{" "}
      <a href={Parameters.sourceURL} target="_blank">
        {t("free software")}
      </a>
      !
      {installable && (
        <div>
          <button type="button" onClick={props.install.install}>
            {t("Install kuzh")}
          </button>
        </div>
      )}
    </header>
  );
}
