import { useEffect, useState } from "react";
import Assembly, { Listerner } from "../model/assembly/Assembly";
import { State } from "../model/assembly/State";
import { Status } from "../model/assembly/Status";
import { Membership } from "../model/Crypto";
import MembershipPanel from "./MembershipPanel";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

type Props = {
  assembly: Assembly;
  menu(): void;
  fail(reason: string): void;
};

export default function AssemblyPage(props: Props): JSX.Element {
  const [assemblyState, setAssemblyState] = useState<State>({
    questions: [],
    present: [],
    absent: [],
    status: Status.waiting("", null, []),
  });
  const [connectionStatus, setConnectionStatus] =
    useState<string>("not connected");

  const listerner: Listerner = {
    state: setAssemblyState,
    failure: props.fail,
    connection: setConnectionStatus,
  };

  useEffect(() => {
    props.assembly.addListener(listerner);
    return () => {
      props.assembly.removeListener(listerner);
    };
  }, [props.assembly.membership.assembly.id]);

  return (
    <div>
      <input
        type="button"
        value="Menu"
        onClick={() => {
          props.assembly.stop();
          props.menu();
        }}
      />
      <ConnectionStatus status={connectionStatus} />
      <StatusPanel
        myFingerprint={props.assembly.membership.me.fingerprint}
        status={assemblyState.status}
        sendAnswer={props.assembly.myAnswer}
        sendQuestion={props.assembly.myQuestion}
        acceptHarvest={props.assembly.acceptHarvest}
        changeReadiness={props.assembly.changeReadiness}
        name={props.assembly.name}
      />
      <h2>Assemblée</h2>
      <PresencePanel
        present={assemblyState.present}
        absent={assemblyState.absent}
        name={props.assembly.name}
      />
      <MembershipPanel membership={props.assembly.membership} />
    </div>
  );
}

function ConnectionStatus(props: { status: string }): JSX.Element {
  return <p>Connexion: {props.status}</p>;
}
