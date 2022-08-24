import { QRCodeSVG } from "qrcode.react";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { useTranslation } from "react-i18next";

export function AssemblySharing(props: {
  assembly: AssemblyInfo;
}): JSX.Element {
  const { t } = useTranslation();

  function connectionURL(): string {
    const loc = window.location;
    return `${loc.protocol}//${loc.host}/assembly/${props.assembly.id}?secret=${
      props.assembly.secret
    }&name=${encodeURIComponent(props.assembly.name)}`;
  }

  async function connectionKeyToClipboard() {
    await navigator.clipboard.writeText(connectionURL());
    alert(
      `${t("The link to this assembly")}, ${connectionURL()}, ${t(
        "have been copied into the clipboard"
      )}.`
    );
  }

  return (
    <div>
      <h4>{t("Share this assembly")}</h4>
      <p>
        {t(
          "To share this assembly, you need the link below. You can either click on the button to copy the link into the clipboard or use the QR code."
        )}
      </p>
      <button
        className="assembly-url-copy-button"
        type="button"
        onClick={connectionKeyToClipboard}
      >
        {t("Copy the link to this assembly into the clipboard")}
      </button>
      <QRCodeSVG
        className="assembly-url-qr-code"
        value={connectionURL()}
        includeMargin={true}
      />
    </div>
  );
}
