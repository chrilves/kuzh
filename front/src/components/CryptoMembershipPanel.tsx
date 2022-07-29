import { CryptoMembership } from "../model/Crypto";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  cryptoMembership: CryptoMembership;
};

export default function CryptoMembershipPanel(props: Props): JSX.Element {
  function connectionURL(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}/assembly/${props.cryptoMembership.assembly.id}?secret=${props.cryptoMembership.assembly.secret}`;
  }

  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(connectionURL());
  }

  return (
    <div>
      <h3>Information de l'assemblée</h3>
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
            <td>{props.cryptoMembership.assembly.name}</td>
            <td>{props.cryptoMembership.assembly.id}</td>
          </tr>
          <tr>
            <td>Moi</td>
            <td>{props.cryptoMembership.me.nickname}</td>
            <td>{props.cryptoMembership.me.fingerprint}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" onClick={connectionKeyToClipboard}>
        Copier le lien vers l'assemblée dans le presse passier.
      </button>
      <div>
        <QRCodeSVG value={connectionURL()} />
      </div>
    </div>
  );
}
