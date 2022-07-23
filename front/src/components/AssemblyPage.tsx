import { useState } from "react";
import { PublicState } from "../model/AssemblyState";
import { CryptoMembership } from "../model/Crypto";
import CryptoMembershipPanel from "./CryptoMembershipPanel";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

type Props = {
  cryptoMembership: CryptoMembership;
  menu(): void;
};

export default function AssemblyPage(props: Props): JSX.Element {
  const [publicState] = useState<PublicState>({
    questions: [],
    presences: [],
    status: PublicState.Status.waiting(null, []),
  });

  return (
    <div>
      <input type="button" value="Menu" onClick={props.menu} />
      <StatusPanel status={publicState.status} names={(m) => "???"} />
      <h2>Assemblée</h2>
      <CryptoMembershipPanel cryptoMembership={props.cryptoMembership} />
      <PresencePanel presence={publicState.presences} names={(x) => "???"} />
    </div>
  );
}
