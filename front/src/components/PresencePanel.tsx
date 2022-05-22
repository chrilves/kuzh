import React from "react";
import { compareNumber, compareString } from "../lib/Compare";
import { MemberPresence } from "../model/AssemblyState";
import { Fingerprint, Name } from "../model/Crypto";
import { MemberList } from "./MemberList";

export type Props = {
  presence: MemberPresence[];
  names: (member: Fingerprint) => Name;
};
export type State = {};

export default class PresencePanel extends React.Component<Props, State> {
  render(): JSX.Element {
    let present: [Name, Fingerprint][] = [];
    let absent: [Name, Fingerprint, number][] = [];

    for (let mp of this.props.presence) {
      let name: Name = this.props.names(mp.member);

      switch (mp.presence.tag) {
        case "present":
          present.push([name, mp.member]);
          break;
        case "absent":
          absent.push([name, mp.member, mp.presence.since]);
          break;
      }
    }

    absent.sort((x, y) => {
      let n = compareNumber(x[2], y[2]);
      if (n != 0) return n;
      let m = compareString(x[1], y[1]);
      if (m != 0) return m;
      return compareString(x[0], y[0]);
    });

    let absentLines: JSX.Element[] = absent.map(
      (
        value: [Name, Fingerprint, number],
        index: number,
        array: [Name, Fingerprint, number][]
      ) => (
        <tr key={value[1]}>
          <td>value[0]</td>
          <td>value[1]</td>
          <td>(new Date(value[2])).toLocaleString()</td>
        </tr>
      )
    );

    return (
      <div>
        <h3>Membres de l'Assemblée</h3>
        <MemberList title="Présent.e.s" members={present} />
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
}
