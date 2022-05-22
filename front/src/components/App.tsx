import React from "react";
import AssemblyPage from "./ConnectionPage";
import Menu from "./MenuPage";
import { StorageAPI } from "../services/StorageAPI";
import { Init as ConnectionInit } from "./ConnectionPage";
import { AssemblyAPI } from "../services/AssemblyAPI";

//////////////////////////////////////////////////////////////////////////////
// Props

type AppProps = {
  storageAPI: StorageAPI;
  assemblyAPI: AssemblyAPI;
  assemblyKey: {id: string, secret: string} | null
};

//////////////////////////////////////////////////////////////////////////////
// STATES

export namespace State {
  export type Menu = {
    page: "menu";
  };

  export const menu: Menu = { page: "menu" };

  export type Assembly = {
    page: "assembly";
    init: ConnectionInit;
  };

  export function assembly(init: ConnectionInit): Assembly {
    return {
      page: "assembly",
      init: init,
    };
  }

  export type DirectJoin = {
    page: "directJoin";
  };

  export const directJoin: DirectJoin = { page: "directJoin" };

}

type State = State.Menu | State.DirectJoin | State.Assembly;

//////////////////////////////////////////////////////////////////////////////
// COMPONENTS

export default class App extends React.Component<AppProps, State> {
  constructor(props: AppProps) {
    super(props);
    this.state = State.menu;
  }

  goToMenu = () => this.setState(State.menu);
  goToAssembly = (init: ConnectionInit) => this.setState(State.assembly(init));

  render(): JSX.Element {
    let page: JSX.Element;
    switch (this.state.page) {
      case "menu":
        page = (
          <Menu
            storageAPI={this.props.storageAPI}
            goToMenu={this.goToMenu}
            goToAssembly={this.goToAssembly}
          />
        );
        break;
      case "directJoin":
        break;
      case "assembly":
        page = (
          <AssemblyPage
            storageAPI={this.props.storageAPI}
            assemblyAPI={this.props.assemblyAPI}
            goToMenu={this.goToMenu}
            init={this.state.init}
          />
        );
        break;
    }
    return (
      <div>
        <h1>Kuzh</h1>
        {page}
      </div>
    );
  }
}
