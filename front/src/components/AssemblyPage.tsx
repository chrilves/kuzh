import { useEffect, useState } from "react";
import Assembly, { ConnectionStatus } from "../model/assembly/Assembly";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { State } from "../model/assembly/State";
import { Status } from "../model/assembly/Status";
import { Fingerprint } from "../model/Crypto";
import { HarvestResult } from "../model/HarvestResult";
import { Question } from "../model/Question";
import { IdentityProofStore } from "../services/IdentityProofStore";
import { AssemblySharing } from "./AssemblySharing";
import { ID } from "./ID";
import MemberList from "./MemberList";
import { Nickname } from "./Nickname";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";
import { useTranslation } from "react-i18next";
import { UXConfig } from "../model/UXConfig";

type Props = {
  addGuest: (
    assemblyInfo: AssemblyInfo,
    nickname: string,
    identityProofStore: IdentityProofStore
  ) => Promise<void>;
  assembly: Assembly;
  fail(error: string): void;
};

export default function AssemblyPage(props: Props): JSX.Element {
  const [assemblyState, setAssemblyState] = useState<State>({
    questions: [],
    present: [],
    absent: [],
    status: Status.waiting("", null, []),
  });
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("closed");

  const [harvestResult, setHarvestResult] = useState<HarvestResult | null>(
    null
  );
  const [autoConfirm, setAutoConfirm] = useState(
    props.assembly.uxConfig.autoConfirm.get()
  );
  const [autoAccept, setAutoValidate] = useState(
    props.assembly.uxConfig.autoAccept.get()
  );
  const [disableBlocking, setDisableBlocking] = useState(
    props.assembly.uxConfig.disableBlocking.get()
  );
  const { t } = useTranslation();

  function setLastHarvestResult(hr: HarvestResult | null): void {
    if (hr) setHarvestResult(hr);
  }

  useEffect(() => {
    props.assembly.stateObservable().addListener(setAssemblyState);
    props.assembly.connectionStatusListener.addListener(setConnectionStatus);
    props.assembly.harvestResultListener().addListener(setLastHarvestResult);
    props.assembly.uxConfig.autoConfirm.addListener(setAutoConfirm);
    props.assembly.uxConfig.autoAccept.addListener(setAutoValidate);
    props.assembly.uxConfig.disableBlocking.addListener(setDisableBlocking);
    return () => {
      props.assembly.stateObservable().removeListener(setAssemblyState);
      props.assembly.connectionStatusListener.removeListener(
        setConnectionStatus
      );
      props.assembly
        .harvestResultListener()
        .removeListener(setLastHarvestResult);
      props.assembly.uxConfig.autoConfirm.removeListener(setAutoConfirm);
      props.assembly.uxConfig.autoAccept.removeListener(setAutoValidate);
      props.assembly.uxConfig.disableBlocking.removeListener(
        setDisableBlocking
      );
    };
  }, [props.assembly]);

  return (
    <div>
      {connectionStatus === "established" ? (
        <StatusPanel
          myFingerprint={props.assembly.membership.me.fingerprint}
          status={assemblyState.status}
          sendOpenAnswer={props.assembly.myOpenAnswer}
          sendClosedAnswer={props.assembly.myClosedAnswer}
          sendQuestion={props.assembly.myQuestion}
          acceptHarvest={props.assembly.acceptHarvest}
          refuseHarvest={props.assembly.refuseHarvest}
          changeReadiness={props.assembly.changeReadiness}
          name={props.assembly.name}
          autoConfirm={autoConfirm}
          autoAccept={autoAccept}
          disableBlocking={disableBlocking}
        />
      ) : (
        <p>
          {t("Sorry, the connection to the server is {{connectionStatus}}.", {
            connectionStatus: t(connectionStatus),
          })}
        </p>
      )}
      <LastHarvestResult
        harvestResult={harvestResult}
        name={props.assembly.name}
      />
      <section className="assembly-info">
        <h3>{t("Assembly")}</h3>
        <ConnectionStatusPanel
          assemblyInfo={props.assembly.membership.assembly}
          status={connectionStatus}
        />
        {connectionStatus === "established" && (
          <NextQuestions questions={assemblyState.questions} />
        )}
        <AssemblySharing assembly={props.assembly.membership.assembly} />
        {connectionStatus === "established" && (
          <PresencePanel
            present={assemblyState.present}
            absent={assemblyState.absent}
            name={props.assembly.name}
          />
        )}
        <UXOptions uxConfig={props.assembly.uxConfig} />
        {connectionStatus === "established" && (
          <AddGuest
            addGuest={(n) =>
              props.addGuest(
                props.assembly.membership.assembly,
                n,
                props.assembly.identityProofStore
              )
            }
            seatNickname={props.assembly.membership.me.nickname}
          />
        )}
      </section>
    </div>
  );
}

function ConnectionStatusPanel(props: {
  assemblyInfo: AssemblyInfo;
  status: ConnectionStatus;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <ID name={props.assemblyInfo.name} id={props.assemblyInfo.id} />
      {t("Connection")}: {t(props.status)}
    </div>
  );
}

function NextQuestions(props: { questions: Question[] }): JSX.Element {
  const { t } = useTranslation();
  if (props.questions.length > 0) {
    return (
      <div>
        <h4>{t("Next questions")}:</h4>
        <ol>
          {props.questions.map((q, i) => (
            <li key={i}>
              ({t(Question.kindText(q.kind))}) {q.message}
            </li>
          ))}
        </ol>
      </div>
    );
  } else {
    return <div></div>;
  }
}

function LastHarvestResult(props: {
  harvestResult: HarvestResult | null;
  name: (member: Fingerprint) => Promise<string>;
}): JSX.Element {
  const [hidden, setHidden] = useState(false);
  const { t } = useTranslation();

  if (props.harvestResult === null) return <div />;

  let page: JSX.Element;

  if (hidden) page = <div />;
  else {
    switch (props.harvestResult.tag) {
      case "question":
        if (props.harvestResult.questions.length === 0)
          page = <p>{t("No more asked question")}.</p>;
        else
          page = (
            <div>
              <p>{t("Asked questions")}:</p>
              <ul>
                {props.harvestResult.questions.map((q, i) => (
                  <li key={i}>
                    ({t(Question.kindText(q.kind))}) {q.message}
                  </li>
                ))}
              </ul>
            </div>
          );
        break;
      case "closed_answer":
        page = (
          <div>
            <p>
              {t("To the question")} "{props.harvestResult.question}",{" "}
              {t("results are")}:
            </p>
            <ul>
              <li>
                {t("YES")}: {props.harvestResult.yes}
              </li>
              <li>
                {t("NO")}: {props.harvestResult.no}
              </li>
            </ul>
          </div>
        );
        break;
      case "open_answer":
        page = (
          <div>
            <p>
              {t("Answers to the question")} "{props.harvestResult.question}":
            </p>
            <ul>
              {props.harvestResult.answers.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        );
    }
  }

  return (
    <section>
      <h3>
        {t("Last harvest")}{" "}
        <button type="button" onClick={() => setHidden(!hidden)}>
          {hidden ? t("Unhide") : t("Hide")}
        </button>
      </h3>
      {!hidden && (
        <div>
          {page}
          <MemberList
            title={t("Participants")}
            members={props.harvestResult.participants}
            name={props.name}
          />
        </div>
      )}
    </section>
  );
}

function UXOption(props: {
  name: string;
  description: string;
  checked: boolean;
  toggle: () => void;
}): JSX.Element {
  return (
    <div onClick={props.toggle}>
      <input
        type="checkbox"
        name={props.name}
        checked={props.checked}
        onChange={() => {}}
      />
      <label>{props.description}</label>
    </div>
  );
}

function UXOptions(props: { uxConfig: UXConfig }): JSX.Element {
  const [hidden, setHidden] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(
    props.uxConfig.autoConfirm.get()
  );
  const [autoAccept, setAutoValidate] = useState(
    props.uxConfig.autoAccept.get()
  );
  const [disableBlocking, setDisableBlocking] = useState(
    props.uxConfig.disableBlocking.get()
  );
  const { t } = useTranslation();

  const toggleAutoConfirm = () => {
    setAutoConfirm(!autoConfirm);
    props.uxConfig.autoConfirm.set(!autoConfirm);
  };
  const toggleAutoValidate = () => {
    setAutoValidate(!autoAccept);
    props.uxConfig.autoAccept.set(!autoAccept);
  };
  const toggleDisableBlocking = () => {
    setDisableBlocking(!disableBlocking);
    props.uxConfig.disableBlocking.set(!disableBlocking);
  };

  if (hidden)
    return (
      <h4>
        {t("Options")}{" "}
        <button type="button" onClick={() => setHidden(false)}>
          {t("Unhide")}
        </button>
      </h4>
    );
  else
    return (
      <fieldset>
        <legend>
          <h4>
            {t("Options")}{" "}
            <button type="button" onClick={() => setHidden(true)}>
              {t("Hide")}
            </button>
          </h4>
        </legend>
        <UXOption
          name="auto-confirm"
          description={t("Do not ask for confirmation.")}
          checked={autoConfirm}
          toggle={toggleAutoConfirm}
        />
        <UXOption
          name="auto-accept"
          description={t("Automatically accept harvests.")}
          checked={autoAccept}
          toggle={toggleAutoValidate}
        />
        <UXOption
          name="disable-blocking"
          description={t("Disable harvest blocking.")}
          checked={disableBlocking}
          toggle={toggleDisableBlocking}
        />
      </fieldset>
    );
}

type AddGuestProps = {
  addGuest: (nickname: string) => Promise<void>;
  seatNickname: string;
};

function AddGuest(props: AddGuestProps): JSX.Element {
  const [counter, setCounter] = useState<number>(1);
  const [nickname, setNickname] = useState<string>(
    `${props.seatNickname}#${counter}`
  );
  const { t } = useTranslation();

  function add() {
    if (validInput()) {
      props.addGuest(nickname);
      setCounter(counter + 1);
      setNickname(`${props.seatNickname}#${counter + 1}`);
    }
  }

  function validInput(): boolean {
    return !!nickname;
  }

  return (
    <section id="add-guest">
      <h3>{t("Add a guest")}</h3>
      <Nickname nickname={nickname} setNickname={setNickname} />
      {validInput() ? (
        <div>
          <button type="button" onClick={add}>
            {t("Add the guest")}
          </button>
        </div>
      ) : (
        <p>{t("Invalid nickname")}</p>
      )}
    </section>
  );
}
