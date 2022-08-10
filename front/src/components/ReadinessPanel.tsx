import { MemberReadiness } from "../model/Member";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";

type Props = {
  readiness: MemberReadiness[];
  name: (member: Fingerprint) => Promise<Name>;
};

export default function ReadinessPanel(props: Props): JSX.Element {
  let ready: Fingerprint[] = [];
  let blocking: Fingerprint[] = [];
  let answering: Fingerprint[] = [];

  for (let mr of props.readiness) {
    switch (mr.readiness) {
      case "ready":
        ready.push(mr.member);
        break;
      case "blocking":
        blocking.push(mr.member);
        break;
      case "answering":
        answering.push(mr.member);
        break;
    }
  }

  return (
    <div>
      <MemberList
        title="Membres en train de répondre"
        members={answering}
        name={props.name}
      />
      <MemberList
        title="Membres qui bloquent la récolte"
        members={blocking}
        name={props.name}
      />
      <MemberList title="Membres prêt.e.s" members={ready} name={props.name} />
    </div>
  );
}
