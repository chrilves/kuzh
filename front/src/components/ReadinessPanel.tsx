import React from "react";
import { compareString } from "../lib/Compare";
import { MemberReadiness } from "../model/AssemblyState";
import { Fingerprint, Name } from "../model/Crypto";
import { MemberList } from "./MemberList";

export type Props = {
  readiness: MemberReadiness[];
  names: (member: Fingerprint) => Name;
};
export type State = {};

export default class ReadinessPanel extends React.Component<Props, State> {
  render(): JSX.Element {
    let ready: [Name, Fingerprint][] = [];
    let busy: [Name, Fingerprint][] = [];

    for (let mr of this.props.readiness) {
      let name: Name = this.props.names(mr.member);

      switch (mr.readiness) {
        case "ready":
          ready.push([name, mr.member]);
          break;
        case "busy":
          busy.push([name, mr.member]);
          break;
      }
    }

    function compare(x: [Name, Fingerprint], y: [Name, Fingerprint]): number {
      let n = compareString(x[0], y[0]);
      if (n != 0) return n;
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

    ready.sort(compare);
    busy.sort(compare);

    return (
      <div>
        <h3>Qui est prêt.e?</h3>
        <MemberList title="Pas encore prêt.e.s" members={busy} />
        <MemberList title="Prêt.e.s" members={ready} />
      </div>
    );
  }
}
