import { compareString } from "../lib/Compare";
import { Fingerprint, Name } from "../model/Crypto";

type MemberListProps = {
  title: string;
  members: [Name, Fingerprint][];
};

export default function MemberList(props: MemberListProps): JSX.Element {
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
        <td>value[0]</td>
        <td>value[1]</td>
      </tr>
    );
  }

  props.members.sort(compare);

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
          <tbody>{props.members.map(renderLine)}</tbody>
        </table>
      )}
    </div>
  );
}
