import { useEffect, useState } from "react";
import Assembly, { Listerner } from "../model/Assembly";
import { AssemblyState } from "../model/AssemblyState";
import { CryptoMembership } from "../model/Crypto";
import CryptoMembershipPanel from "./CryptoMembershipPanel";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

type Props = {
  assembly: Assembly;
  menu(): void;
  fail(reason: string): void;
};

export default function AssemblyPage(props: Props): JSX.Element {
  const [assemblyState, setAssemblyState] = useState<AssemblyState>({
    questions: [],
    presences: [],
    status: AssemblyState.Status.waiting(null, []),
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
  }, [props.assembly.cryptoMembership().assembly.id]);

  return (
    <div>
      <input type="button" value="Menu" onClick={props.menu} />
      <ConnectionStatus status={connectionStatus} />
      <StatusPanel status={assemblyState.status} names={(m) => "???"} />
      <h2>Assemblée</h2>
      <PresencePanel presence={assemblyState.presences} names={(x) => "???"} />
      <CryptoMembershipPanel
        cryptoMembership={props.assembly.cryptoMembership()}
      />
    </div>
  );
}

function ConnectionStatus(props: { status: string }): JSX.Element {
  return <p>Connexion: {props.status}</p>;
}
