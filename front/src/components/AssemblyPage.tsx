import { useEffect, useState } from "react";
import { French } from "../French";
import Assembly, { ConnectionStatus } from "../model/assembly/Assembly";
import { State } from "../model/assembly/State";
import { Status } from "../model/assembly/Status";
import { Fingerprint } from "../model/Crypto";
import { HarvestResult } from "../model/HarvestResult";
import { Question } from "../model/Question";
import MemberList from "./MemberList";
import MembershipPanel from "./MembershipPanel";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

type Props = {
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

  function setLastHarvestResult(hr: HarvestResult | null): void {
    if (hr) setHarvestResult(hr);
  }

  useEffect(() => {
    props.assembly.stateListener().addListener(setAssemblyState);
    props.assembly.connectionStatusListerner.addListener(setConnectionStatus);
    props.assembly.harvestResultListener().addListener(setLastHarvestResult);
    return () => {
      props.assembly.stateListener().removeListener(setAssemblyState);
      props.assembly.connectionStatusListerner.removeListener(
        setConnectionStatus
      );
      props.assembly
        .harvestResultListener()
        .removeListener(setLastHarvestResult);
    };
  }, [props.assembly]);

  return (
    <div>
      <StatusPanel
        myFingerprint={props.assembly.membership.me.fingerprint}
        status={assemblyState.status}
        sendOpenAnswer={props.assembly.myOpenAnswer}
        sendClosedAnswer={props.assembly.myClosedAnswer}
        sendQuestion={props.assembly.myQuestion}
        acceptHarvest={props.assembly.acceptHarvest}
        changeReadiness={props.assembly.changeReadiness}
        name={props.assembly.name}
      />
      <LastHarvestResult
        harvestResult={harvestResult}
        name={props.assembly.name}
      />
      <h3>Assemblée</h3>
      <NextQuestions questions={assemblyState.questions} />
      <PresencePanel
        present={assemblyState.present}
        absent={assemblyState.absent}
        name={props.assembly.name}
      />
      <MembershipPanel membership={props.assembly.membership} />
      <ConnectionStatusPanel status={connectionStatus} />
    </div>
  );
}

function ConnectionStatusPanel(props: { status: string }): JSX.Element {
  return <p>Connexion: {props.status}</p>;
}

function NextQuestions(props: { questions: Question[] }): JSX.Element {
  if (props.questions.length > 0) {
    return (
      <div>
        <h4>Prochaines questions:</h4>
        <ol>
          {props.questions.map((q, i) => (
            <li key={i}>
              ({French.questionKind(q.kind)}) {q.message}
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

  if (props.harvestResult === null) return <div />;

  let page: JSX.Element;

  if (hidden) page = <div />;
  else {
    switch (props.harvestResult.tag) {
      case "question":
        if (props.harvestResult.questions.length === 0)
          page = <p>Aucune question posée</p>;
        else
          page = (
            <div>
              <p>Questions posées:</p>
              <ul>
                {props.harvestResult.questions.map((q, i) => (
                  <li key={i}>
                    ({French.questionKind(q.kind)}) {q.message}
                  </li>
                ))}
              </ul>
            </div>
          );
        break;
      case "closed_answer":
        page = (
          <div>
            <p>À la question "{props.harvestResult.question}", ont répondu:</p>
            <ul>
              <li>OUI: {props.harvestResult.yes}</li>
              <li>NON: {props.harvestResult.no}</li>
            </ul>
          </div>
        );
        break;
      case "open_answer":
        page = (
          <div>
            <p>Réponses à la question "{props.harvestResult.question}":</p>
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
    <div>
      <h3>
        Dernière récolte{" "}
        <button type="button" onClick={() => setHidden(!hidden)}>
          {hidden ? "Démasquer" : "Masquer"}
        </button>
      </h3>
      {!hidden && (
        <div>
          {page}
          <MemberList
            title="Participant.e.s"
            members={props.harvestResult.participants}
            name={props.name}
          />
        </div>
      )}
    </div>
  );
}
