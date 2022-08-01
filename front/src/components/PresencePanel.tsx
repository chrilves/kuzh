import { compareNumber, compareString } from "../lib/Compare";
import { MemberPresence } from "../model/Member";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { useState } from "react";

export declare function structuredClone(value: any): any;

type Props = {
  presence: MemberPresence[];
  name: (member: Fingerprint) => Promise<Name>;
};

export default function PresencePanel(props: Props): JSX.Element {
  const [names, setNames] = useState<Map<Fingerprint, Name>>(new Map());

  function withName(member: Fingerprint): Name {
    const name = names.get(member);
    if (name) return name;

    (async () => {
      const name = await props.name(member);
      names.set(member, name);
      setNames(structuredClone(names));
    })();
    return "???";
  }

  let present: Fingerprint[] = [];
  let absent: [Fingerprint, number][] = [];

  for (let mp of props.presence) {
    switch (mp.presence.tag) {
      case "present":
        present.push(mp.member);
        break;
      case "absent":
        absent.push([mp.member, mp.presence.since]);
        break;
    }
  }

  absent.sort((x, y) => {
    let n = compareNumber(x[1], y[1]);
    if (n !== 0) return n;
    return compareString(x[0], y[0]);
  });

  let absentLines: JSX.Element[] = absent.map(
    (
      value: [Fingerprint, number],
      index: number,
      array: [Fingerprint, number][]
    ) => (
      <tr key={value[1]}>
        <td>{withName(value[0])}</td>
        <td>{value[0]}</td>
        <td>{new Date(value[1]).toLocaleString()}</td>
      </tr>
    )
  );

  return (
    <div>
      <h3>Membres de l'Assemblée</h3>
      <MemberList title="Présent.e.s" members={present} name={props.name} />
      <h4>Absent.e.s: {absentLines.length}</h4>
      {absentLines.length > 0 && (
        <table>
          <thead>
            <tr key="header">
              <th>Nom</th>
              <th>Identifiant</th>
              <th>Depuis</th>
            </tr>
          </thead>
          <tbody>{absentLines}</tbody>
        </table>
      )}
    </div>
  );
}
