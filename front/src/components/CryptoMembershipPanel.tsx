import { CryptoMembership } from "../model/Crypto";

type Props = {
  cryptoMembership: CryptoMembership;
};

export default function CryptoMembershipPanel(props: Props): JSX.Element {
  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(
      `${props.cryptoMembership.assembly.uuid},${props.cryptoMembership.assembly.secret}`
    );
  }

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
            <td>{props.cryptoMembership.assembly.name}</td>
            <td>{props.cryptoMembership.assembly.uuid}</td>
          </tr>
          <tr>
            <td>Moi</td>
            <td>{props.cryptoMembership.me.nickname}</td>
            <td>{props.cryptoMembership.me.fingerprint}</td>
          </tr>
        </tbody>
      </table>
      <button type="button" onClick={connectionKeyToClipboard}>
        Copier la clef de connection de l'assemblée dans le presse passier.
      </button>
    </div>
  );
}
