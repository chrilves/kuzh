import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { Operation } from "../model/Operation";
import { SeatState } from "../model/SteatState";
import { IdentityProofStore } from "../services/IdentityProofStore";
import AssemblyPage from "./AssemblyPage";
import { ID } from "./ID";
import { useTranslation } from "react-i18next";

type Props = {
  addGuest: (
    assemblyInfo: AssemblyInfo,
    nickname: string,
    identityProofStore: IdentityProofStore
  ) => Promise<void>;
  state: SeatState;
  setState(st: SeatState): void;
  reset: () => Promise<void>;
  exit(): void;
};

export default function SeatPage(props: Props): JSX.Element {
  const { t } = useTranslation();

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
        <AssemblyPage
          addGuest={props.addGuest}
          assembly={props.state.assembly}
          fail={fail}
        />
      );
      break;
  }

  const member = SeatState.member(props.state);

  return (
    <article>
      <header>
        <h2>
          <ID
            name={member.nickname}
            id={
              member.assembly ? member.assembly.membership.me.fingerprint : ""
            }
          />
        </h2>
        <div>
          <button type="button" onClick={props.exit}>
            {t("Exit")}
          </button>
          <button type="button" onClick={props.reset}>
            {t("Reset")}
          </button>
        </div>{" "}
      </header>
      {page}
    </article>
  );
}

function Create(props: { create: Operation.Create }): JSX.Element {
  const { t } = useTranslation();

  return (
    <section>
      <p>{t("Creating a new assembly")}</p>
      <ul>
        <li>
          <label>{t("Assembly name")}:</label>{" "}
          <em>{props.create.assemblyName}</em>
        </li>
        <li>
          <label>{t("Your nickname")}:</label> <em>{props.create.nickname}</em>.
        </li>
      </ul>
    </section>
  );
}

export function Join(props: { join: Operation.Join }): JSX.Element {
  const { t } = useTranslation();
  return (
    <section>
      <p>{t("Connecting to an existing assembly.")}</p>
      <ul>
        <li>
          <label>{t("Assembly ID")}:</label> <em>{props.join.id}</em>
        </li>
        <li>
          <label>{t("Your nickname")}:</label> <em>{props.join.nickname}</em>.
        </li>
      </ul>
    </section>
  );
}

export function Failure(props: { error: any }): JSX.Element {
  const { t } = useTranslation();

  let errorMessage: JSX.Element;

  function renderError(err: Error): JSX.Element {
    let lines = [
      <p>
        <label>{t("Name")}</label>: <em>{props.error.name}</em>
      </p>,
      <p>
        <label>{t("Message")}</label>: <em>{props.error.message}</em>
      </p>,
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
      errorMessage = <p>{t("The error is a ... function ???")}</p>;
      break;
    case "object":
      if (props.error instanceof Error) errorMessage = renderError(props.error);
      else if (props.error instanceof String)
        errorMessage = <p>{props.error}</p>;
      else
        errorMessage = (
          <p>
            {t("Unknown error of type")} ${typeof props.error} {t("and value")}{" "}
            {JSON.stringify(props.error)}
          </p>
        );
  }

  return (
    <section>
      <h3>{t("Error")}:</h3>
      {errorMessage}
    </section>
  );
}
