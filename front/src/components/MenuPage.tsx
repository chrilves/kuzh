import React, { ChangeEvent } from 'react';
import { Assembly } from '../lib/Model';
import { StorageAPI } from '../lib/StorageAPI';

interface Props {
    storageAPI: StorageAPI
    goToMenu(): void
    goToAssembly(): void
}

interface GoToAssembly {
    goToAssembly(): void
}

export default class Menu extends React.Component<Props> {
    constructor(props: Props) {
        super(props);
        this.state = { lastAssembly: true }
    }

    render(): JSX.Element {
        const lastAssembly = this.props.storageAPI.fetchLastAssembly();
        return <div className="App">
            <h1>Kuzh</h1>
            {lastAssembly ? <LastAssembly lastAssembly={lastAssembly} goToAssembly={this.props.goToAssembly} /> : null}
            <Join goToAssembly={this.props.goToAssembly} />
            <Create goToAssembly={this.props.goToAssembly} />
        </div>;
    }
}

type LastAssemblyProps = {
    last_assembly: Assembly,
    goToAssembly(): void
}

class LastAssembly extends React.Component<LastAssemblyProps, {}> {
    render(): JSX.Element {
        return <div className="kuzh-rejoin-last-assembly">
            <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
            <ul>
                <li>UUID: {this.props.last_assembly.uuid}</li>
                <li>Secret: {this.props.last_assembly.secret}</li>
                <li>Name: {this.props.last_assembly.name}</li>
                <li>Nickname: {this.props.last_assembly.me.nickname}</li>
            </ul>
            <form onSubmit={this.props.goToAssembly}>
                <input type="submit" name="join_last_assembly" value="Revenir à la dernière Assemblée" />
            </form>
        </div>;
    }
}


class Join extends React.Component<GoToAssembly, {}> {
    render(): JSX.Element {
        return <div className="kuzh-join-assembly">
            <h2 className="kuzh-style-action">Rejoindre une Assemblée existante</h2>
            <form onSubmit={this.props.goToAssembly}>
                <label>
                    <input type="text" name="assembly_key" placeholder="clef de connexion de l'assemblée"/>
                </label>
                <input type="submit" name="join_assembly" value="Rejoindre l'Assemblée" />
            </form>
        </div>;
    }
}

type CreateState = {
    assembly_name: string,
    nickname: string
}

class Create extends React.Component<GoToAssembly, CreateState> {
    constructor(props: GoToAssembly) {
        super(props);
        this.state = {
            assembly_name: "",
            nickname: ""
        };
    }

    updateAssemblyName = (e: ChangeEvent<HTMLInputElement>) => this.setState({assembly_name: e.target.value});
    updateNickname = (e: ChangeEvent<HTMLInputElement>) => this.setState({nickname: e.target.value});

    render(): JSX.Element {
        return <div className="kuzh-create-assembly">
            <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
            <form onSubmit={this.props.goToAssembly}>
                <label>
                    assemblée:
                    <input type="text" name="assembly_name" placeholder="nom de l'assemblée" onChange={this.updateAssemblyName} />
                </label>
                <label>
                    pseudo:
                    <input type="text" name="nickname" placeholder="vote pseudo" />
                </label>
                <input type="submit" name="create_assembly" value="Créer l'Assemblée" onChange={this.updateNickname} />
            </form>
        </div>;
    }
}