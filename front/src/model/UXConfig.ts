import { ObservableVar } from "../lib/Var";
import { StorageAPI } from "../services/StorageAPI";

export interface UXConfig {
  autoConfirm: ObservableVar<boolean>;
  autoAccept: ObservableVar<boolean>;
  disableBlocking: ObservableVar<boolean>;
}

export namespace UXConfig {
  export function fromStorageAPI(storageAPI: StorageAPI): UXConfig {
    console.log(`AUTO1: ${JSON.stringify(storageAPI.autoConfirm)}`);
    console.log(
      `AUTO2: ${JSON.stringify(
        ObservableVar.fromGetSet(storageAPI.autoConfirm).observable
      )}`
    );
    return {
      autoConfirm: ObservableVar.fromGetSet(storageAPI.autoConfirm),
      autoAccept: ObservableVar.fromGetSet(storageAPI.autoAccept),
      disableBlocking: ObservableVar.fromGetSet(storageAPI.disableBlocking),
    };
  }
}
