import { Fingerprint, Name } from "../model/Crypto";
import { AssemblyState } from "../model/AssemblyState";
import HarvestingPanel from "./HarvestingPanel";
import WaitingPanel from "./WaitingPanel";

type Props = {
  status: AssemblyState.Status;
  sendAnswer(answer: boolean): void;
  sendQuestion(question: string | null): void;
  name: (member: Fingerprint) => Promise<Name>;
};

export default function StatusPanel(props: Props): JSX.Element {
  switch (props.status.tag) {
    case "waiting":
      return (
        <WaitingPanel
          waiting={props.status}
          sendAnswer={props.sendAnswer}
          sendQuestion={props.sendQuestion}
          name={props.name}
        />
      );
    case "harvesting":
      return <HarvestingPanel harvesting={props.status} name={props.name} />;
  }
}
