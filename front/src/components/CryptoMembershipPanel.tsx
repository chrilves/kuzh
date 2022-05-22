import React from "react";
import { CryptoMembership } from "../model/Crypto";

export type Props = {
  cryptoMembership: CryptoMembership;
};
export type State = {};

export default class CryptoMembershipPanel extends React.Component<
  Props,
  State
> {
  constructor(props: Props) {
    super(props);
    this.connectionKeyToClipboard = this.connectionKeyToClipboard.bind(this);
  }

  async connectionKeyToClipboard() {
    await navigator.clipboard.writeText(
      `${this.props.cryptoMembership.assembly.uuid},${this.props.cryptoMembership.assembly.secret}`
    );
  }

  render(): JSX.Element {
    return (
      <div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Nom</th>
              <th>Identifiant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Assemblée</td>
              <td>{this.props.cryptoMembership.assembly.name}</td>
              <td>{this.props.cryptoMembership.assembly.uuid}</td>
            </tr>
            <tr>
              <td>Moi</td>
              <td>{this.props.cryptoMembership.me.nickname}</td>
              <td>{this.props.cryptoMembership.me.fingerprint}</td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={this.connectionKeyToClipboard}>
          Copier la clef de connection de l'assemblée dans le presse passier.
        </button>
      </div>
    );
  }
}
