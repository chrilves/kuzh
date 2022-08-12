import { useEffect, useState } from "react";
import { French } from "../French";
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
import MembershipPanel from "./MembershipPanel";
import { Nickname } from "./Nickname";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

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
      <section className="assembly-info">
        <h3>Assemblée</h3>
        <ConnectionStatusPanel
          assemblyInfo={props.assembly.membership.assembly}
          status={connectionStatus}
        />
        <NextQuestions questions={assemblyState.questions} />
        <AssemblySharing assembly={props.assembly.membership.assembly} />
        <PresencePanel
          present={assemblyState.present}
          absent={assemblyState.absent}
          name={props.assembly.name}
        />
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
      </section>
    </div>
  );
}

function ConnectionStatusPanel(props: {
  assemblyInfo: AssemblyInfo;
  status: string;
}): JSX.Element {
  return (
    <div>
      <ID name={props.assemblyInfo.name} id={props.assemblyInfo.id} />
      Connexion: {props.status}
    </div>
  );
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
    <section>
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
    </section>
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
      <h3>Ajouter Un.e invitée</h3>
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
    </section>
  );
}
