import { useState } from "react";
import { compareString } from "../lib/Compare";
import { Fingerprint, Name } from "../model/Crypto";

export declare function structuredClone(value: any): any;

type Props = {
  title: string;
  members: Fingerprint[];
  name(member: Fingerprint): Promise<Name>;
};

export default function MemberList(props: Props): JSX.Element {
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

  function compare(x: [Name, Fingerprint], y: [Name, Fingerprint]): number {
    let n = compareString(x[0], y[0]);
    if (n !== 0) return n;
    return compareString(x[1], y[1]);
  }

  function renderLine(
    value: [Name, Fingerprint],
    index: number,
    array: [Name, Fingerprint][]
  ): JSX.Element {
    return (
      <tr key={value[1]}>
        <td>{value[0]}</td>
        <td>{value[1]}</td>
      </tr>
    );
  }

  return (
    <div>
      <h4>
        {props.title}: {props.members.length}
      </h4>
      {props.members.length > 0 && (
        <table>
          <thead>
            <tr key="header">
              <th>Nom</th>
              <th>Identifiant</th>
            </tr>
          </thead>
          <tbody>
            {props.members
              .map((x: Fingerprint): [Name, Fingerprint] => [withName(x), x])
              .sort(compare)
              .map(renderLine)}
          </tbody>
        </table>
      )}
    </div>
  );
}
