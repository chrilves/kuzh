import React from 'react';
import './App.css';

type MemberStatus = "absent" | "busy" | "ready"

type AssemblyPageProps = {
    uuid: string,
    name: string,
    secret: string
    goToMenu(): void
}

export class Members extends React.Component<{}, {}> {
    constructor(props: {}) {
        super(props);
    }

  render(): JSX.Element {
        return <div className="">
            <table>
                <thead>
                    <tr>
                        <td>Nom</td>
                        <td>Présent·e</td>
                        <td>Score</td>
                        <td>Empreinte</td>
                    </tr>
                </thead>
                <tbody>

                </tbody>
            </table>
            </div>;
    }
}

export default class AssemblyPage extends React.Component<AssemblyPageProps, {}> {
    constructor(props: AssemblyPageProps) {
        super(props);

    }

  render(): JSX.Element {
        return <div className="Assembly">
            <h1>Assembée {this.props.uuid}</h1>
            <h2>Présent·e·s</h2>
            <Members />
            <h2>Absent·e·s</h2>
            <Members />
            <h2>Questions</h2>
            <h2><input type="button" value="Menu" onClick={this.props.goToMenu}/></h2>
        </div>;
    }
}