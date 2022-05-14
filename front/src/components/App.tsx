import React from 'react';
import AssemblyPage from './Assembly';
import Menu from './Menu';
import { StorageAPI } from '../lib/StorageAPI';
import { Init as AssemblyInit } from './Assembly'

//////////////////////////////////////////////////////////////////////////////
// Props

type AppProps = {
  storageAPI: StorageAPI  
}

//////////////////////////////////////////////////////////////////////////////
// STATES

export namespace State {
  export type Menu = {
    page: "MENU"
  }

  export const menu : Menu = { page: "MENU" };

  export type Assembly = {
    page: "ASSEMBLY",
    init: AssemblyInit.Init
  }

  export function assembly(init: AssemblyInit.Init): Assembly {
    return {
      page: "ASSEMBLY",
      init: init
    };
  }

  export type Page = Menu | Assembly;
}

//////////////////////////////////////////////////////////////////////////////
// COMPONENTS

export default class App extends React.Component<AppProps, State.Page> {
  constructor(props: AppProps) {
    super(props);
    this.state = State.menu;
  }

  goToMenu = () => this.setState(State.menu);
  goToAssembly = (init: AssemblyInit.Init) => this.setState(State.assembly(init))

  render(): JSX.Element {
    switch (this.state.page) {
      case "MENU": {
        return <Menu goToMenu={this.goToMenu} goToAssembly={this.goToAssembly}/>;
      };
      case "ASSEMBLY": {
        return <AssemblyPage storageAPI={this.props.storageAPI} goToMenu={this.goToMenu} init={this.state.init} />;
      };
    }
  }
}