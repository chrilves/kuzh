import React from "react";
import { Fingerprint, Name } from "../model/Crypto";
import { PublicState } from "../model/AssemblyState";

export type Props = {
  harvesting: PublicState.Status.Harvesting;
  names: (member: Fingerprint) => Name;
};
export type State = {};

export default class HarvestingPanel extends React.Component<Props, State> {
  render(): JSX.Element {
    return (
      <div>
        <h2>Harvesting</h2>
      </div>
    );
  }
}
