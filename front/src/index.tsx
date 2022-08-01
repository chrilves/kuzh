import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { realServices, testServices } from "./services/Services";
import App from "./components/App";
//import reportWebVitals from './reportWebVitals';

/////////////////////////////
// Initialisation!

const root: ReactDOM.Root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const players: number = 5;

let screen: JSX.Element;

if (players === 0) screen = <div />;
else if (players === 1) screen = <App services={realServices()} />;
else
  screen = (
    <div style={{ display: "flex", flexDirection: "row" }}>
      {Array.from(Array(players).keys()).map((x) => (
        <div key={`j${x + 1}`} style={{ display: "auto" }}>
          <App services={testServices(`j${x + 1}`)} />
        </div>
      ))}
    </div>
  );

root.render(
  <React.StrictMode>
    <BrowserRouter>{screen}</BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();
