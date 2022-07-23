import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { LocalStorageAPI, StorageAPI } from "./services/StorageAPI";
import { BackAPI, RealBackAPI } from "./services/BackAPI";
import { AssemblyAPI, RealAssemblyAPI } from "./services/AssemblyAPI";
import { Services } from "./services/Services";
import App from "./components/App";
//import reportWebVitals from './reportWebVitals';

/////////////////////////////
// Initialisation!

const storageAPI: StorageAPI = new LocalStorageAPI();
const backAPI: BackAPI = new RealBackAPI("http://localhost:8081");
const assemblyAPI: AssemblyAPI = new RealAssemblyAPI(storageAPI, backAPI);

const services: Services = {
  storageAPI: storageAPI,
  assemblyAPI: assemblyAPI,
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
