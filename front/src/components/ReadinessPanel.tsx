import { compareString } from "../lib/Compare";
import { MemberReadiness } from "../model/Member";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { useState } from "react";

export declare function structuredClone(value: any): any;

type Props = {
  readiness: MemberReadiness[];
  name: (member: Fingerprint) => Promise<Name>;
};

export default function ReadinessPanel(props: Props): JSX.Element {
  const [names, setNames] = useState<Map<Fingerprint, Name>>(new Map());

  function withName(member: Fingerprint): [Name, Fingerprint] {
    const name = names.get(member);
    if (name) return [name, member];

    (async () => {
      const name = await props.name(member);
      names.set(member, name);
      setNames(structuredClone(names));
    })();
    return ["???", member];
  }

  let ready: Fingerprint[] = [];
  let busy: Fingerprint[] = [];

  for (let mr of props.readiness) {
    switch (mr.readiness) {
      case "ready":
        ready.push(mr.member);
        break;
      case "busy":
        busy.push(mr.member);
        break;
    }
  }

  ready.sort(compareString);
  busy.sort(compareString);

  return (
    <div>
      <h3>Qui est prêt.e?</h3>
      <MemberList title="Pas encore prêt.e.s" members={busy.map(withName)} />
      <MemberList title="Prêt.e.s" members={ready.map(withName)} />
    </div>
  );
}
