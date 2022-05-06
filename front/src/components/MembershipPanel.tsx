import { Membership } from "../model/Crypto";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  membership: Membership;
};

export default function MembershipPanel(props: Props): JSX.Element {
  function connectionURL(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}/assembly/${props.membership.assembly.id}?secret=${props.membership.assembly.secret}`;
  }

  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(connectionURL());
  }

  return (
    <div>
      <h4>Information de l'assemblée</h4>
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
            <td>{props.membership.assembly.name}</td>
            <td>{props.membership.assembly.id}</td>
          </tr>
          <tr>
            <td>Moi</td>
            <td>{props.membership.me.nickname}</td>
            <td>{props.membership.me.fingerprint}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" onClick={connectionKeyToClipboard}>
        Copier le lien vers l'assemblée dans le presse passier.
      </button>
      <div>
        <QRCodeSVG value={connectionURL()} includeMargin={true} />
      </div>
    </div>
  );
}
