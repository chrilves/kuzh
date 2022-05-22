import React from "react";
import { PublicState } from "../model/AssemblyState";
import { CryptoMembership } from "../model/Crypto";
import CryptoMembershipPanel from "./CryptoMembershipPanel";
import PresencePanel from "./PresencePanel";
import StatusPanel from "./StatusPanel";

export type Props = {
  cryptoMembership: CryptoMembership;
  goToMenu(): void;
};

export type State = {
  publicState: PublicState;
};

export default class AssemblyPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      publicState: {
        questions: [],
        presences: [],
        status: PublicState.Status.waiting(null, []),
      },
    };
  }

  render(): JSX.Element {
    return (
      <div>
        <input type="button" value="Menu" onClick={this.props.goToMenu} />
        <StatusPanel
          status={this.state.publicState.status}
          names={(m) => "???"}
        />
        <h2>Assemblée</h2>
        <CryptoMembershipPanel cryptoMembership={this.props.cryptoMembership} />
        <PresencePanel
          presence={this.state.publicState.presences}
          names={(x) => "???"}
        />
      </div>
    );
  }
}
