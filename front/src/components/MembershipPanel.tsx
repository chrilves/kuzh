import { Membership } from "../model/Crypto";
import { AssemblySharing } from "./AssemblySharing";
import { ID } from "./ID";

type Props = {
  membership: Membership;
};

export default function MembershipPanel(props: Props): JSX.Element {
  return (
    <ul>
      <li>
        Assemblée:
        <ID
          name={props.membership.assembly.name}
          id={props.membership.assembly.id}
        />
      </li>
      <li>
        Toi:
        <ID
          name={props.membership.me.nickname}
          id={props.membership.me.fingerprint}
        />
      </li>
    </ul>
  );
}
