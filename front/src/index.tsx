import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { LocalStorageAPI, StorageAPI } from "./services/StorageAPI";
import { BackAPI, RealBackAPI } from "./services/BackAPI";
import { AssemblyAPI, RealAssemblyAPI } from "./services/AssemblyAPI";
import { Services } from "./services/Services";
import App from "./components/App";
import { BackCachingIdentityProofStoreFactory } from "./services/IdentityProofStore";
import { withAsync } from "./lib/Utils";
import { Me } from "./model/Crypto";
import { JSONNormalizedStringifyD } from "./lib/JSONNormalizedStringify";
import Fuse from "./lib/Fuse";
//import reportWebVitals from './reportWebVitals';

/////////////////////////////
// Initialisation!

const storageAPI: StorageAPI = new LocalStorageAPI();
const backAPI: BackAPI = new RealBackAPI("http://localhost:8081");
const assemblyAPI: AssemblyAPI = new RealAssemblyAPI(storageAPI, backAPI);
const identityProofStoreFactory = new BackCachingIdentityProofStoreFactory(
  backAPI
);

const services: Services = {
  storageAPI: storageAPI,
  assemblyAPI: assemblyAPI,
  identityProofStoreFactory: identityProofStoreFactory,
};

const root: ReactDOM.Root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App services={services} />
    </BrowserRouter>
  </React.StrictMode>
);

/*

function Debug(): JSX.Element {
  const [fuse] = useState<Fuse>(new Fuse());
  const [ip, setIP] = useState<string>("");

  useEffect(
    withAsync(async () => {
      if (await fuse.break()) {
        const me = await Me.generate("toto");
        const ip = await me.identityProof();
        const serial = await ip.toJson();
        setIP(JSONNormalizedStringifyD(serial));
      }
    })
  );

  return <p>{ip}</p>;
}
*/

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
