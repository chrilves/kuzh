import React, { ChangeEvent } from "react";
import { CryptoMembership } from "../model/Crypto";
import { StorageAPI } from "../services/StorageAPI";
import { Init as ConnectionInit } from "./ConnectionPage";
import CryptoMembershipPanel from "./CryptoMembershipPanel";

interface Props {
  storageAPI: StorageAPI;
  goToMenu(): void;
  goToAssembly(init: ConnectionInit): void;
}

interface GoToAssembly {
  goToAssembly(init: ConnectionInit): void;
}

type State = {
  lastCryptoMembership: CryptoMembership | null;
};

export default class Menu extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { lastCryptoMembership: null };
  }

  async componentDidMount() {
    const last = await this.props.storageAPI.fetchLastCryptoMembership();
    this.setState({ lastCryptoMembership: last });
  }

  render(): JSX.Element {
    return (
      <div className="App">
        {this.state.lastCryptoMembership && (
          <LastAssembly
            lastCryptoMembership={this.state.lastCryptoMembership}
            goToAssembly={this.props.goToAssembly}
          />
        )}
        <Join goToAssembly={this.props.goToAssembly} />
        <Create goToAssembly={this.props.goToAssembly} />
      </div>
    );
  }
}

type LastAssemblyProps = {
  lastCryptoMembership: CryptoMembership;
  goToAssembly(init: ConnectionInit): void;
};

class LastAssembly extends React.Component<LastAssemblyProps, {}> {
  render(): JSX.Element {
    return (
      <div className="kuzh-rejoin-last-assembly">
        <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
        <CryptoMembershipPanel
          cryptoMembership={this.props.lastCryptoMembership}
        />
        <input
          type="button"
          name="join_last_assembly"
          value="Revenir à la dernière Assemblée"
          onClick={() =>
            this.props.goToAssembly(
              ConnectionInit.last(this.props.lastCryptoMembership)
            )
          }
        />
      </div>
    );
  }
}

type JoinState = {
  assemblyKey: string;
  nickname: string;
};

class Join extends React.Component<GoToAssembly, JoinState> {
  constructor(props: GoToAssembly) {
    super(props);
    this.state = {
      assemblyKey: "",
      nickname: "",
    };
    this.join = this.join.bind(this);
    this.handleAssemblyKeyChange = this.handleAssemblyKeyChange.bind(this);
    this.handleNickNameChange = this.handleNickNameChange.bind(this);
  }

  join() {
    const arr = this.state.assemblyKey.split(",", 2);
    this.props.goToAssembly(
      ConnectionInit.join(arr[0], arr[1], this.state.nickname)
    );
  }

  handleAssemblyKeyChange(e: ChangeEvent<HTMLInputElement>) {
    this.setState({ assemblyKey: e.target.value });
  }

  handleNickNameChange(e: ChangeEvent<HTMLInputElement>) {
    this.setState({ nickname: e.target.value });
  }

  validInput(): boolean {
    return true;
  }

  render(): JSX.Element {
    return (
      <div className="kuzh-join-assembly">
        <h2 className="kuzh-style-action">Rejoindre une Assemblée existante</h2>
        <form onSubmit={this.join}>
          <div>
            <label>Clef de connexion : </label>
            <input
              type="text"
              name="assembly_key"
              placeholder="clef de connexion de l'assemblée"
              value={this.state.assemblyKey}
              onChange={this.handleAssemblyKeyChange}
            />
          </div>
          <div>
            <label>pseudo : </label>
            <input
              type="text"
              name="nickname"
              placeholder="vote pseudo"
              value={this.state.nickname}
              onChange={this.handleNickNameChange}
            />
          </div>
          {this.validInput() && (
            <div>
              <input
                type="submit"
                name="join_assembly"
                value="Rejoindre l'Assemblée"
              />
            </div>
          )}
        </form>
      </div>
    );
  }
}

type CreateState = {
  assemblyName: string;
  nickname: string;
};

class Create extends React.Component<GoToAssembly, CreateState> {
  constructor(props: GoToAssembly) {
    super(props);
    this.state = {
      assemblyName: "asm",
      nickname: "toto",
    };
    this.create = this.create.bind(this);
    this.handleAssemblyNameChange = this.handleAssemblyNameChange.bind(this);
    this.handleNicknameChange = this.handleNicknameChange.bind(this);
  }

  create() {
    this.props.goToAssembly(
      ConnectionInit.create(this.state.assemblyName, this.state.nickname)
    );
  }

  handleAssemblyNameChange(e: ChangeEvent<HTMLInputElement>) {
    this.setState({ assemblyName: e.target.value });
  }

  handleNicknameChange(e: ChangeEvent<HTMLInputElement>) {
    this.setState({ nickname: e.target.value });
  }

  validInput(): boolean {
    return true;
  }

  render(): JSX.Element {
    return (
      <div className="kuzh-create-assembly">
        <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
        <form onSubmit={this.create}>
          <div>
            <label>assemblée : </label>
            <input
              type="text"
              name="assemblyName"
              placeholder="nom de l'assemblée"
              value={this.state.assemblyName}
              onChange={this.handleAssemblyNameChange}
            />
          </div>
          <div>
            <label>pseudo : </label>
            <input
              type="text"
              name="nickname"
              placeholder="vote pseudo"
              value={this.state.nickname}
              onChange={this.handleNicknameChange}
            />
          </div>
          {this.validInput() && (
            <div>
              <input
                type="submit"
                name="createAssembly"
                value="Créer l'Assemblée"
              />
            </div>
          )}
        </form>
      </div>
    );
  }
}
