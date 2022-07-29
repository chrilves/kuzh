import { Fingerprint, Name } from "../model/Crypto";
import { AssemblyState } from "../model/AssemblyState";
import HarvestingPanel from "./HarvestingPanel";
import WaitingPanel from "./WaitingPanel";

type Props = {
  status: AssemblyState.Status;
  names: (member: Fingerprint) => Name;
};

export default function StatusPanel(props: Props): JSX.Element {
  switch (props.status.tag) {
    case "waiting":
      return <WaitingPanel waiting={props.status} names={props.names} />;
    case "harvesting":
      return <HarvestingPanel harvesting={props.status} names={props.names} />;
  }
}