import { Operation } from "../model/Operation";
import AssemblyPage from "./AssemblyPage";
import { SeatState } from "../model/SteatState";

type Props = {
  state: SeatState;
  setState(st: SeatState): void;
  reset: () => Promise<void>;
  exit(): void;
};

export default function SeatPage(props: Props): JSX.Element {
  let page: JSX.Element;

  function fail(error: string) {
    props.setState(SeatState.failure(error));
  }

  switch (props.state.tag) {
    case "prepare":
      switch (props.state.operation.tag) {
        case "create":
          page = <Create create={props.state.operation} />;
          break;
        case "join":
          page = <Join join={props.state.operation} />;
          break;
      }
      break;

    case "failure":
      page = <Failure error={props.state.error} />;
      break;

    case "assembly":
      page = (
        <div>
          <AssemblyPage assembly={props.state.assembly} fail={fail} />
        </div>
      );
      break;
  }

  let nickname: string;
  switch (props.state.tag) {
    case "prepare":
      nickname = props.state.operation.nickname;
      break;
    case "assembly":
      nickname = props.state.assembly.membership.me.nickname;
      break;
    case "failure":
      nickname = "Oups";
      break;
  }

  return (
    <div style={{ display: "auto" }}>
      <h2>Votant.e: {nickname}</h2>
      <div>
        <button type="button" onClick={props.exit}>
          Quitter
        </button>
        <button type="button" onClick={props.reset}>
          Relancer
        </button>
      </div>
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

export function Join(props: { join: Operation.Join }): JSX.Element {
  return (
    <div>
      <p>Connection à une assemblée existance.</p>
      <ul>
        <li>
          <span className="listKey">Identifiant de l'assemblée:</span>{" "}
          <span className="assemblyId">{props.join.id}</span>
        </li>
        <li>
          <span className="listKey">Votre pesudo:</span>{" "}
          <span className="nickName">{props.join.nickname}</span>.
        </li>
      </ul>
    </div>
  );
}

export function Failure(props: { error: string }): JSX.Element {
  return (
    <div>
      <h3>Erreur:</h3>
      <p>
        <span className="error">{props.error}</span>.
      </p>
    </div>
  );
}
