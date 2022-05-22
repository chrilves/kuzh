import React from "react";
import { Fingerprint, Name } from "../model/Crypto";
import { PublicState } from "../model/AssemblyState";
import HarvestingPanel from "./HarvestingPanel";
import WaitingPanel from "./WaitingPanel";

export type Props = {
  status: PublicState.Status;
  names: (member: Fingerprint) => Name;
};
export type State = {};

export default class StatusPanel extends React.Component<Props, State> {
  render(): JSX.Element {
    switch (this.props.status.tag) {
      case "waiting":
        return (
          <WaitingPanel waiting={this.props.status} names={this.props.names} />
        );
      case "harvesting":
        return (
          <HarvestingPanel
            harvesting={this.props.status}
            names={this.props.names}
          />
        );
    }
  }
}
