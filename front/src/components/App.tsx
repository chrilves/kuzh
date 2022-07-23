import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppState } from "../model/AppState";
import { CryptoMembership } from "../model/Crypto";
import { Operation } from "../model/Operation";
import { AssemblyAPI } from "../services/AssemblyAPI";
import { Services } from "../services/Services";
import AssemblyPage from "./AssemblyPage";
import Menu from "./Menu";

export default function App(props: { services: Services }): JSX.Element {
  const [appState, setAppState] = useState<AppState>(AppState.menu);
  const navigate = useNavigate();

  function menu() {
    setAppState(AppState.menu);
    navigate("/");
  }

  function assembly(cryptoMembership: CryptoMembership) {
    console.log(
      `Navigation vers l'assemblée ${cryptoMembership.assembly.uuid}`
    );
    setAppState(AppState.assembly(cryptoMembership));
    navigate(`/assembly/${cryptoMembership.assembly.uuid}`);
  }

  async function prepare(operation: Operation) {
    setAppState(AppState.prepare(operation));
    try {
      let cryptoMembership: CryptoMembership = await AssemblyAPI.fold(
        props.services.assemblyAPI
      )(operation);
      assembly(cryptoMembership);
    } catch (e) {
      setAppState(AppState.failure(`${e}`));
    }
  }

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
    case "prepare":
      switch (appState.operation.tag) {
        case "create":
          page = <Create create={appState.operation} />;
          break;
        case "join":
          page = <Join join={appState.operation} />;
          break;
      }
      break;

    case "failure":
      page = <Failure reason={appState.reason} menu={menu} />;
      break;

    case "assembly":
      page = (
        <AssemblyPage
          cryptoMembership={appState.cryptoMembership}
          menu={menu}
        />
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

function Create(props: { create: Operation.Create }): JSX.Element {
  return (
    <div>
      <p>Création d'une nouvelle assemblée</p>
      <ul>
        <li>
          <span className="listKey">Nom de l'assemblée:</span>{" "}
          <span className="assemblyId">{props.create.assemblyName}</span>
        </li>
        <li>
          <span className="listKey">Votre pesudo:</span>{" "}
          <span className="nickName">{props.create.nickname}</span>.
        </li>
      </ul>
    </div>
  );
}

function Join(props: { join: Operation.Join }): JSX.Element {
  return (
    <div>
      <p>Connection à une assemblée existance.</p>
      <ul>
        <li>
          <span className="listKey">Identifiant de l'assemblée:</span>{" "}
          <span className="assemblyId">{props.join.uuid}</span>
        </li>
        <li>
          <span className="listKey">Votre pesudo:</span>{" "}
          <span className="nickName">{props.join.nickname}</span>.
        </li>
      </ul>
    </div>
  );
}

function Failure(props: { reason: string; menu(): void }): JSX.Element {
  return (
    <div>
      <button type="button" onClick={props.menu}>
        Menu
      </button>
      <h1>Erreur:</h1>
      <p>
        <span className="error">{props.reason}</span>.
      </p>
    </div>
  );
}
