import { Membership } from "../model/Crypto";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

type Props = {
  membership: Membership;
};

export default function MembershipPanel(props: Props): JSX.Element {
  function connectionURL(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}/assembly/${
      props.membership.assembly.id
    }?secret=${props.membership.assembly.secret}&name=${encodeURIComponent(
      props.membership.assembly.name
    )}`;
  }

  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(connectionURL());
    alert(
      `Le lien vers l'assemblée, ${connectionURL()}, à été copié dans le presse papier.`
    );
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
      <h5>Diffuser le lien vers cette assemblée</h5>
      <p>
        Pour rejoindre l'asemblée il faut le lien que tu peux récupérer ici! Tu
        peux le copier dans le presse presse-papier, en cliquant sur le bouton
        ou utiliser le QR code.
      </p>
      <button type="button" onClick={connectionKeyToClipboard}>
        Copier le lien vers l'assemblée dans le presse passier.
      </button>
      <div>
        <QRCodeSVG value={connectionURL()} includeMargin={true} />
      </div>
    </div>
  );
}
