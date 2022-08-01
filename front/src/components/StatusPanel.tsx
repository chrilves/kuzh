import { Fingerprint, Name } from "../model/Crypto";
import { AssemblyState } from "../model/AssemblyState";
import HarvestingPanel from "./HarvestingPanel";
import WaitingPanel from "./WaitingPanel";
import ProposedPanel from "./ProposedPanel";
import { Member } from "../model/Member";

type Props = {
  myFingerprint: Fingerprint;
  status: AssemblyState.Status;
  sendAnswer(answer: boolean): void;
  sendQuestion(question: string | null): void;
  acceptHarvest(): void;
  changeReadiness(r: Member.Blockingness): void;
  name: (member: Fingerprint) => Promise<Name>;
};

export default function StatusPanel(props: Props): JSX.Element {
  switch (props.status.tag) {
    case "waiting":
      return (
        <WaitingPanel
          myFingerprint={props.myFingerprint}
          waiting={props.status}
          sendAnswer={props.sendAnswer}
          sendQuestion={props.sendQuestion}
          changeReadiness={props.changeReadiness}
          name={props.name}
        />
      );
    case "proposed":
      return (
        <ProposedPanel
          proposed={props.status}
          name={props.name}
          acceptHarvest={props.acceptHarvest}
          changeReadiness={props.changeReadiness}
        />
      );
    case "harvesting":
      return <HarvestingPanel harvesting={props.status} name={props.name} />;

    case "hidden":
      return <Hidden />;
  }
}

function Hidden(): JSX.Element {
  return (
    <div>
      <h2>Veuillez attendre</h2>
      <p>Une récolte est en cours. Vous pourrez participer bientôt.</p>
    </div>
  );
}
