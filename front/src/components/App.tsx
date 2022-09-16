import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
import Install from "../services/Install";
import { Services } from "../services/Services";
import { DummyStorageAPI } from "../services/StorageAPI";
import Menu from "./Menu";
import Seat from "./SeatPage";

export default function App(props: {
  services: Services;
  refAppState: RefAppState;
}): JSX.Element {
  const [appState, setAppState] = useState<AppState>(props.refAppState.appState.get());
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    props.refAppState.appState.addListener(setAppState);
    return () => props.refAppState.appState.removeListener(setAppState);
  }, [props.refAppState]);

  ////////////////////
  // App Operations //
  ////////////////////

  function menu() {
    const st = appState;
    switch (st.tag) {
      case "seats":
        SeatState.stop(st.host.state);
        SeatState.removeListener(st.host.state);
        for (const gs of st.guests) {
          SeatState.stop(gs.seat.state);
          SeatState.removeListener(gs.seat.state);
        }
        break;
      default:
    }
    navigate("/");
    props.refAppState.appState.set(AppState.menu);
  }

  /////////////////////
  // Host Operations //
  /////////////////////

  async function prepare(operation: Operation): Promise<void> {
    props.refAppState.appState.set(
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
    const temporaryState = SeatState.prepare(
      Operation.join(
        membership.assembly.id,
        membership.assembly.name,
        membership.assembly.secret,
        membership.me.nickname
      )
    );

    props.refAppState.appState.set(
      AppState.seats(
        {
          state: temporaryState,
          setState: props.refAppState.setHostState,
          exit: menu,
          reset: async () => {
            await assembly(membership);
          },
        },
        props.refAppState.guests()
      )
    );

    const asm = new Assembly(
      props.services.storageAPI,
      props.services.identityProofStoreFactory.identityProofStore(
        membership.assembly
      ),
      props.services.assemblyAPI,
      membership,
      props.refAppState.hostState
    );

    props.refAppState.appState.set(
      AppState.seats(
        {
          state: temporaryState,
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
    const st = props.refAppState.appState.get();
    if (st.tag === "seats") {
      const guestID = crypto.randomUUID();

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
        const st = props.refAppState.appState.get();
        if (st.tag === "seats") {
          let membership: Membership = await AssemblyAPI.fold(guestAssemblyAPI)(
            operation
          );

          asm = new Assembly(
            new DummyStorageAPI(),
            identityProofStore,
            guestAssemblyAPI,
            membership,
            props.refAppState.guestState(guestID)
          );

          const idx = st.guests.findIndex((gs) => gs.guestID === guestID);
          if (idx !== -1) {
            const newGuests = Array.from(st.guests);
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

            props.refAppState.appState.set(AppState.seats(st.host, newGuests));
          }

          return asm.start();
        } else throw new Error(t("ERROR_CONNECT_GUEST_NO_SEAT_MODE"));
      };

      const newGuests = Array.from(st.guests);

      newGuests.push({
        guestID: guestID,
        seat: {
          state: SeatState.prepare(operation),
          setState: (s) => props.refAppState.setGuestState(guestID, s),
          reset: connect,
          exit: () => props.refAppState.deleteGuest(guestID),
        },
      });
      props.refAppState.appState.set(AppState.seats(st.host, newGuests));

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

  switch (appState.tag) {
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
            state={appState.host.state}
            setState={props.refAppState.setHostState}
            exit={menu}
            reset={appState.host.reset}
            addGuest={addGuest}
          />
          {appState.guests.map((g) => (
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
    props.install.listenInstall.addListener(setInstallable);
    return () => props.install.listenInstall.removeListener(setInstallable);
  }, [props.install.listenInstall]);

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
      <a href={Parameters.sourceURL} target="_blank" rel="noreferrer">
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
