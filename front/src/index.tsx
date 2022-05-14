import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/App';
import { LocalStorageAPI, StorageAPI } from './lib/StorageAPI';
//import reportWebVitals from './reportWebVitals';

/////////////////////////////
// Initialisation!

const storageAPI: StorageAPI = new LocalStorageAPI;

const root: ReactDOM.Root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App storageAPI={storageAPI}/>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
