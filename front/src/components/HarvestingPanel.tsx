import { Fingerprint, Name } from "../model/Crypto";
import { PublicState } from "../model/AssemblyState";

type Props = {
  harvesting: PublicState.Status.Harvesting;
  names: (member: Fingerprint) => Name;
};

export default function HarvestingPanel(props: Props): JSX.Element {
  return (
    <div>
      <h2>Harvesting</h2>
    </div>
  );
}
