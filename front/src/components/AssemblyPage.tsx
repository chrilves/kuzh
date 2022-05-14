import React from 'react';
import { Assembly, Me } from '../lib/Model';
import {Mutex, MutexInterface, Semaphore, SemaphoreInterface, withTimeout} from 'async-mutex';
import { StorageAPI } from '../lib/StorageAPI';

export namespace Init  {
    export type Create = {
        tag: "CREATE",
        assembly_name: string
        nickname: string
    }

    export function create(assembly_name: string, nickname: string): Create {
        return {
            tag: "CREATE",
            assembly_name: assembly_name,
            nickname: nickname
        };
    }
    
    export type Join = {
        tag: "JOIN",
        uuid: string,
        secret: string,
        nickname: string
    }

    export function join(uuid: string, secret: string, nickname: string): Join {
        return {
            tag: "JOIN",
            uuid: uuid,
            secret: secret,
            nickname: nickname
        };
    }
    
    export type Last = {
        tag: "LAST";
        assembly: Assembly
    }

    export function last(assembly: Assembly): Last {
        return {
            tag: "LAST",
            assembly: assembly
        };
    }
}

export type Init = Init.Create | Init.Join | Init.Last;

export interface Props {
    init: Init,
    storageAPI: StorageAPI,
    goToMenu(): void
}

export namespace State {
    export type Connecting = {
        tag: "CONNECTING"
        init: Init
    }

    export function connecting(init: Init): Connecting {
        return {
            tag: "CONNECTING",
            init: init
        };
    }

    export type Connected = {
        tag: "CONNECTED"
        assembly: Assembly
    }

    export function connected(assembly: Assembly): Connected {
        return {
            tag: "CONNECTED",
            assembly: assembly
        };
    }

    export type Failed = {
        tag: "FAILED"
        reason: string
    }

    export function Failed(reason: string): Failed {
        return {
            tag: "FAILED",
            reason: reason
        };
    }
}

type State = State.Connecting | State.Connected | State.Failed;

export default class AssemblyPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    console.log(`Entering constructor! ${Math.random()}`)
    this.state = State.connecting(props.init);
  }
  
  async componentDidMount() {
    switch (this.state.tag) {
        case "CONNECTING": {
            switch (this.props.init.tag) {
                case "LAST" : {
                    this.setState(State.connected(this.props.init.assembly))
                    break;
                }
                case "JOIN": {
                    const lastAssembly = this.props.storageAPI.fetchLastAssembly();
                    let me: Me;
                    if (lastAssembly && lastAssembly.uuid === this.props.init.uuid) {
                        console.log("Reusing the same identity");
                        me = {
                            keyPair: lastAssembly.me.keyPair,
                            publicKeyJWK: lastAssembly.me.publicKeyJWK,
                            nickname: this.props.init.nickname
                        };
                    } else {
                        me = await Me.generate(this.props.init.nickname);
                    }

                    break;
                }
                case "CREATE": {
                    break;
                }
            }
            break;
        }
        case "CONNECTED": {
            console.log("Already connected!");
            break;
        }
        case "FAILED": {
            console.log("Already failed!");
            break;
        }
    }
  }

  render(): JSX.Element {
    let base64 = "NO KEY YET";
    if (this.state.exportedPublicKey) {
        base64 = JSON.stringify(this.state.exportedPublicKey)
    }

    return <div className="Assembly">
        <h1>Assembée: {this.props.name}</h1>
        <br/>
        <ul>
            <li>UUID={this.props.uuid}</li>
            <li>Secret={this.props.secret}</li>
            <li>Base64={base64}</li>
        </ul>
        <h2>Présent·e·s</h2>
        <Members />
        <h2>Absent·e·s</h2>
        <Members />
        <h2>Questions</h2>
        <h2><input type="button" value="Menu" onClick={this.props.goToMenu}/></h2>
    </div>;
  }
}



export class Members extends React.Component<{}, {}> {
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
  