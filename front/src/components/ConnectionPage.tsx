import React from "react";
import { CryptoMembership } from "../model/Crypto";
import { StorageAPI } from "../services/StorageAPI";
import { AssemblyAPI } from "../services/AssemblyAPI";
import Fuse from "../lib/Fuse";
import CryptoMembershipPanel from "./CryptoMembershipPanel";
import AssemblyPage from "./AssemblyPage";

export namespace Init {
  export type Create = {
    tag: "create";
    assemblyName: string;
    nickname: string;
  };

  export function create(assemblyName: string, nickname: string): Create {
    return {
      tag: "create",
      assemblyName: assemblyName,
      nickname: nickname,
    };
  }

  export type Join = {
    tag: "join";
    uuid: string;
    secret: string;
    nickname: string;
  };

  export function join(uuid: string, secret: string, nickname: string): Join {
    return {
      tag: "join",
      uuid: uuid,
      secret: secret,
      nickname: nickname,
    };
  }

  export type Last = {
    tag: "last";
    cryptoMembership: CryptoMembership;
  };

  export function last(cryptoMembership: CryptoMembership): Last {
    return {
      tag: "last",
      cryptoMembership: cryptoMembership,
    };
  }
}

export type Init = Init.Create | Init.Join | Init.Last;

export interface Props {
  init: Init;
  storageAPI: StorageAPI;
  assemblyAPI: AssemblyAPI;
  goToMenu(): void;
}

export namespace Connection {
  export type Connecting = {
    tag: "connecting";
    init: Init;
  };

  export function connecting(init: Init): Connecting {
    return {
      tag: "connecting",
      init: init,
    };
  }

  export type Connected = {
    tag: "connected";
    cryptoMembership: CryptoMembership;
  };

  export function connected(cryptoMembership: CryptoMembership): Connected {
    return {
      tag: "connected",
      cryptoMembership: cryptoMembership,
    };
  }

  export type Failed = {
    tag: "failed";
    reason: string;
  };

  export function failed(reason: string): Failed {
    return {
      tag: "failed",
      reason: reason,
    };
  }
}

type Connection =
  | Connection.Connecting
  | Connection.Connected
  | Connection.Failed;

type State = {
  fuse: Fuse;
  connection: Connection;
};

export default class ConnectionPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fuse: new Fuse(),
      connection: Connection.connecting(props.init),
    };
  }

  async componentDidMount() {
    if (await this.state.fuse.break()) {
      switch (this.state.connection.tag) {
        case "connecting": {
          try {
            let cryptoMembership: CryptoMembership;
            switch (this.props.init.tag) {
              case "last": {
                cryptoMembership = this.props.init.cryptoMembership;
                break;
              }
              case "join": {
                cryptoMembership = await this.props.assemblyAPI.join(
                  this.props.init.uuid,
                  this.props.init.secret,
                  this.props.init.nickname
                );
                break;
              }
              case "create": {
                cryptoMembership = await this.props.assemblyAPI.create(
                  this.props.init.assemblyName,
                  this.props.init.nickname
                );
                break;
              }
            }

            //await this.props.assemblyAPI.connect(cryptoMembership);

            this.setState({
              connection: Connection.connected(cryptoMembership),
            });
          } catch (exn) {
            console.log(`Connection failed ${exn}`);
            this.setState({
              connection: Connection.failed(`Connection failed ${exn}`),
            });
          }
          break;
        }
        case "connected": {
          console.log("Already connected!");
          break;
        }
        case "failed": {
          console.log("Already failed!");
          break;
        }
      }
    } else {
      console.log("Assembly creation already started!");
    }
  }

  componentWillUnmount() {
    console.log("Unmounting assembly");
  }

  render(): JSX.Element {
    switch (this.state.connection.tag) {
      case "connecting":
        return <Connecting init={this.state.connection.init} />;
      case "connected":
        return (
          <AssemblyPage
            cryptoMembership={this.state.connection.cryptoMembership}
            goToMenu={this.props.goToMenu}
          />
        );
      case "failed":
        return (
          <Failed
            reason={this.state.connection.reason}
            goToMenu={this.props.goToMenu}
          />
        );
    }
  }
}

class Connecting extends React.Component<{ init: Init }> {
  render(): JSX.Element {
    switch (this.props.init.tag) {
      case "last":
        return (
          <div>
            <h1>Connection à la dernière assemblée</h1>
            <CryptoMembershipPanel
              cryptoMembership={this.props.init.cryptoMembership}
            />
          </div>
        );
      case "join":
        return (
          <div>
            <h1>Connection à une assemblée existance.</h1>
            <ul>
              <li>
                <span className="listKey">Identifiant de l'assemblée:</span>{" "}
                <span className="assemblyId">{this.props.init.uuid}</span>
              </li>
              <li>
                <span className="listKey">Votre pesudo:</span>{" "}
                <span className="nickName">{this.props.init.nickname}</span>.
              </li>
            </ul>
          </div>
        );
      case "create":
        return (
          <div>
            <h1>Création d'une nouvelle assemblée</h1>
            <ul>
              <li>
                <span className="listKey">Nom de l'assemblée:</span>{" "}
                <span className="assemblyId">
                  {this.props.init.assemblyName}
                </span>
              </li>
              <li>
                <span className="listKey">Votre pesudo:</span>{" "}
                <span className="nickName">{this.props.init.nickname}</span>.
              </li>
            </ul>
          </div>
        );
    }
  }
}

type FailedProps = {
  reason: string;
  goToMenu(): void;
};

class Failed extends React.Component<FailedProps> {
  render(): JSX.Element {
    return (
      <div>
        <input type="button" value="Menu" onClick={this.props.goToMenu} />
        <h1>Echec de Connexion</h1>
        <p>
          <span className="error">{this.props.reason}</span>.
        </p>
      </div>
    );
  }
}
