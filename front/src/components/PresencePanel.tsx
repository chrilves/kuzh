import { compareNumber, compareString } from "../lib/Compare";
import { MemberAbsent } from "../model/Member";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { useState } from "react";
import { ID } from "./ID";

export declare function structuredClone(value: any): any;

type Props = {
  present: Fingerprint[];
  absent: MemberAbsent[];
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

  props.absent.sort((x, y) => {
    let n = compareNumber(y.since, x.since);
    if (n !== 0) return n;
    return compareString(x.member, y.member);
  });

  let absentLines: JSX.Element[] = props.absent.map((value: MemberAbsent) => (
    <tr key={value.member}>
      <td>{new Date(value.since).toLocaleTimeString()}</td>
      <td>
        <ID name={withName(value.member)} id={value.member} />
      </td>
    </tr>
  ));

  return (
    <div>
      {absentLines.length > 0 && (
        <div>
          <h4>Absent.e.s: {absentLines.length}</h4>
          {absentLines.length > 0 && (
            <table className="absent">
              <tbody>{absentLines}</tbody>
            </table>
          )}
        </div>
      )}
      <MemberList
        title="Présent.e.s"
        members={props.present}
        name={props.name}
      />
    </div>
  );
}
