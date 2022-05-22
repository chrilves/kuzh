import React from "react";
import { compareString } from "../lib/Compare";
import { Fingerprint, Name } from "../model/Crypto";

export type MemberListProps = {
  title: string;
  members: [Name, Fingerprint][];
};

export class MemberList extends React.Component<MemberListProps, {}> {
  constructor(props: MemberListProps) {
    super(props);
    this.compare = this.compare.bind(this);
    this.renderLine = this.renderLine.bind(this);
  }

  compare(x: [Name, Fingerprint], y: [Name, Fingerprint]): number {
    let n = compareString(x[0], y[0]);
    if (n != 0) return n;
    return compareString(x[1], y[1]);
  }

  renderLine(
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

  render(): JSX.Element {
    this.props.members.sort(this.compare);
    return (
      <div>
        <h4>
          {this.props.title}: {this.props.members.length}
        </h4>
        {this.props.members.length > 0 && (
          <table>
            <thead>
              <tr key="header">
                <th>Nom</th>
                <th>Identifiant</th>
              </tr>
            </thead>
            <tbody>{this.props.members.map(this.renderLine)}</tbody>
          </table>
        )}
      </div>
    );
  }
}
