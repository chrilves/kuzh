import React from 'react';
import './App.css';

interface MenuProps {
    goToMenu(): void
    goToAssembly(): void
}

interface GoToAssembly {
    goToAssembly(): void
}

export default class Menu extends React.Component<MenuProps, { last_assembly: Boolean }> {
    constructor(props: MenuProps) {
        super(props);
        this.state = { last_assembly: true }
    }

    render(): JSX.Element {
        return <div className="App">
            <h1>Kuzh</h1>
            {this.state.last_assembly ? <LastAssembly goToAssembly={this.props.goToAssembly} /> : null}
            <Join goToAssembly={this.props.goToAssembly} />
            <Create goToAssembly={this.props.goToAssembly} />
        </div>;
    }
}

class LastAssembly extends React.Component<GoToAssembly, {}> {
    constructor(props: GoToAssembly) {
        super(props);
    }

    render(): JSX.Element {
        return <div className="kuzh-rejoin-last-assembly">
            <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
            <form onSubmit={this.props.goToAssembly}>
                <input type="submit" name="join_last_assembly" value="Revenir à la dernière Assemblée" />
            </form>
        </div>;
    }
}


class Join extends React.Component<GoToAssembly, {}> {
    constructor(props: GoToAssembly) {
        super(props);
    }

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


class Create extends React.Component<GoToAssembly, {}> {
    constructor(props: GoToAssembly) {
        super(props);
    }

    render(): JSX.Element {
        return <div className="kuzh-create-assembly">
            <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
            <form onSubmit={this.props.goToAssembly}>
                <label>
                    <input type="text" name="assembly_name" placeholder="nom de l'assemblée"/>
                </label>
                <input type="submit" name="create_assembly" value="Créer l'Assemblée" />
            </form>
        </div>;
    }
}