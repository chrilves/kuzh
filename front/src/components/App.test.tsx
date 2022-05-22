import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { LocalStorageAPI } from "../services/StorageAPI";
import { MutexedAssemblyAPI, RealAssemblyAPI } from "../services/AssemblyAPI";
import { RealBackAPI } from "../services/BackAPI";

test("renders learn react link", () => {
  const storageAPI = new LocalStorageAPI();
  const backAPI = new RealBackAPI("http://localhost:9000/");
  const assemblyAPI = new MutexedAssemblyAPI(
    new RealAssemblyAPI(storageAPI, backAPI)
  );
  render(<App storageAPI={storageAPI} assemblyAPI={assemblyAPI} />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
