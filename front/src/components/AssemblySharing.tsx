import { QRCodeSVG } from "qrcode.react";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";

export function AssemblySharing(props: {
  assembly: AssemblyInfo;
}): JSX.Element {
  function connectionURL(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}/assembly/${props.assembly.id}?secret=${
      props.assembly.secret
    }&name=${encodeURIComponent(props.assembly.name)}`;
  }

  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(connectionURL());
    alert(
      `Le lien vers l'assemblée, ${connectionURL()}, à été copié dans le presse papier.`
    );
  }

  return (
    <div>
      <h4>Diffuser le lien vers cette assemblée</h4>
      <p>
        Pour rejoindre l'asemblée il faut le lien que tu peux récupérer ici! Tu
        peux le copier dans le presse presse-papier, en cliquant sur le bouton
        ou utiliser le QR code.
      </p>
      <button
        className="assembly-url-copy-button"
        type="button"
        onClick={connectionKeyToClipboard}
      >
        Copier le lien vers l'assemblée dans le presse passier.
      </button>
      <QRCodeSVG
        className="assembly-url-qr-code"
        value={connectionURL()}
        includeMargin={true}
      />
    </div>
  );
}
