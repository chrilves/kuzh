import React from 'react';
import './App.css';
import AssemblyPage from './Assembly';
import Menu from './Menu';

type pages = "menu" | "assembly";

type AppState = {
  page: pages;
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.goToMenu = this.goToMenu.bind(this);
    this.goToAssembly = this.goToAssembly.bind(this);
    this.state = { page: "assembly" };
  }

  goToMenu() {
    this.setState({page: 'menu'});
  }

  goToAssembly() {
    this.setState({page: 'assembly'});
  }

  render(): JSX.Element {
    let page;
    switch (this.state.page) {
      case "menu": {
        page = <Menu goToMenu={this.goToMenu} goToAssembly={this.goToAssembly}/>;
        break;
      };
      case "assembly": {
        page = <AssemblyPage uuid="" name="" secret="" goToMenu={this.goToMenu}/>;
        break;
      };
    }
    return page;
  }
}