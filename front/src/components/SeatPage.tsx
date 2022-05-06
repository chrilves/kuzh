import { Operation } from "../model/Operation";
import { SeatState } from "../model/SteatState";
import AssemblyPage from "./AssemblyPage";

type Props = {
  state: SeatState;
  setState(st: SeatState): void;
  reset: () => Promise<void>;
  exit(): void;
};

export default function SeatPage(props: Props): JSX.Element {
  let page: JSX.Element;

  function fail(error: string) {
    const member = SeatState.member(props.state);
    props.setState(SeatState.failure(error, member.nickname, member.assembly));
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

  const member = SeatState.member(props.state);

  return (
    <div>
      <div>
        <button type="button" onClick={props.exit}>
          Quitter
        </button>
        <button type="button" onClick={props.reset}>
          Relancer
        </button>
      </div>
      <h2>{member.nickname}</h2>
      <h3>{member.assembly?.membership.me.fingerprint}</h3>
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

export function Failure(props: { error: any }): JSX.Element {
  let errorMessage: JSX.Element;

  function renderError(err: Error): JSX.Element {
    let lines = [
      <p>Nom: {props.error.name}</p>,
      <p>Message: {props.error.message}</p>,
    ];
    if (props.error.cause)
      lines.push(<p>Cause: {renderError(props.error.cause)}</p>);
    if (props.error.stack) lines.push(<p>Stack: {props.error.stack}</p>);
    return (
      <ul>
        {lines.map((x, k) => (
          <li key={k}>{x}</li>
        ))}
      </ul>
    );
  }

  switch (typeof props.error) {
    case "bigint":
    case "string":
    case "boolean":
    case "number":
    case "undefined":
      errorMessage = <p>{`${props.error}`}</p>;
      break;
    case "symbol":
      errorMessage = <p>{String(props.error)}</p>;
      break;
    case "function":
      errorMessage = <p>L'erreur est .... une fonction ??? Etrange ...</p>;
      break;
    case "object":
      if (props.error instanceof Error) errorMessage = renderError(props.error);
      else if (props.error instanceof String)
        errorMessage = <p>{props.error}</p>;
      else
        errorMessage = (
          <p>
            Erreur inconue de type ${typeof props.error} et valeur $
            {JSON.stringify(props.error)}
          </p>
        );
  }

  return (
    <div>
      <h3>Erreur:</h3>
      <p>
        <span className="error">{errorMessage}</span>.
      </p>
    </div>
  );
}
