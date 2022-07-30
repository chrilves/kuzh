import { Membership } from "./Crypto";
import { Operation } from "./Operation";
import * as AssemblyModel from "./Assembly";

export namespace AppState {
  export type Menu = {
    tag: "menu";
  };

  export const menu: Menu = {
    tag: "menu",
  };

  export type Prepare = {
    tag: "prepare";
    operation: Operation;
  };

  export function prepare(Operation: Operation): Prepare {
    return {
      tag: "prepare",
      operation: Operation,
    };
  }

  export type Failure = {
    tag: "failure";
    reason: string;
  };

  export function failure(r: string): Failure {
    return {
      tag: "failure",
      reason: r,
    };
  }

  export type Assembly = {
    tag: "assembly";
    assembly: AssemblyModel.default;
  };

  export function assembly(assembly: AssemblyModel.default): Assembly {
    return {
      tag: "assembly",
      assembly: assembly,
    };
  }
}

export type AppState =
  | AppState.Menu
  | AppState.Prepare
  | AppState.Failure
  | AppState.Assembly;
