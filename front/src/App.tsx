import React from 'react';
import logo from './logo.svg';
import './App.css';

type AppState = {
  last_assembly: Boolean
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = { last_assembly: true }
  }

  render(): JSX.Element {
    return <div className="App">
            <header className="App-header">
              <h1>Kuzh</h1>
              { this.state.last_assembly ?
                <div className="kuzh-rejoin-last-assembly">
                  <h2 className="kuzh-style-action">Revenir à la dernière Assemblée</h2>
                  <form>
                    <input type="button" name="join_last_assembly" value="Revenir à la dernière Assemblée"/>
                  </form>
                </div>
                : null
              }
              <div className="kuzh-join-assembly">
                <h2 className="kuzh-style-action">Rejoindre une Assemblée existante</h2>
                <form>
                  <input type="text" name="assembly_key" placeholder="clef de connexion de l'assemblée"></input>
                  <input type="button" name="join_assembly" value="Rejoindre l'Assemblée"/>
                </form>
              </div>
              <div className="kuzh-create-assembly">
                <h2 className="kuzh-style-action">Créer une nouvelle Assemblée</h2>
                <form>
                  <input type="text" name="assembly_name" placeholder="nom de l'assemblée"></input>
                  <input type="button" name="create_assembly" value="Créer l'Assemblée"/>
                </form>
              </div>

              {/* <img src={logo} className="App-logo" alt="logo" />
              <p>
                Edit <code>src/App.tsx</code> and save to reload.
              </p>
              <a
                className="App-link"
                href="https://reactjs.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn React
            </a> */}
            </header>
          </div>;
  }
}