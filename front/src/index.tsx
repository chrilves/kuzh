import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./components/App";
import {
  AssemblyAPI,
  AssemblyAPIFactory,
  RealAssemblyAPI,
  RealAssemblyAPIFactory,
} from "./services/AssemblyAPI";
import { BackAPI, RealBackAPI } from "./services/BackAPI";
import {
  BackCachingIdentityProofStoreFactory,
  IdentityProofStoreFactory,
} from "./services/IdentityProofStore";
import { StorageAPI, LocalStorageAPI } from "./services/StorageAPI";
import { Services } from "./services/Services";
import { AppState } from "./model/AppState";
import { RefAppState } from "./model/RefAppState";
//import reportWebVitals from './reportWebVitals';

/////////////////////////////
// Initialisation!

const root: ReactDOM.Root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const storageAPI: StorageAPI = new LocalStorageAPI();
const backAPI: BackAPI = new RealBackAPI("http://localhost:8081");
const assemblyAPI: AssemblyAPI = new RealAssemblyAPI(storageAPI, backAPI);
const identityProofStoreFactory: IdentityProofStoreFactory =
  new BackCachingIdentityProofStoreFactory(storageAPI, backAPI);
const assemblyAPIFactory: AssemblyAPIFactory = new RealAssemblyAPIFactory(
  backAPI
);

const services: Services = {
  storageAPI: storageAPI,
  assemblyAPI: assemblyAPI,
  identityProofStoreFactory: identityProofStoreFactory,
  assemblyAPIFactory: assemblyAPIFactory,
};

const refAppState = new RefAppState(AppState.menu);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App services={services} refAppState={refAppState} />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
