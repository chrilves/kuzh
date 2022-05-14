import { Mutex } from "async-mutex";
import { Assembly } from "./Model"; 

export interface StorageAPI {
  fetchLastAssembly(): Assembly | null 
  storeLastAssembly(assembly: Assembly): void
  getMutex(): Mutex
}

export class LocalStorageAPI implements StorageAPI {
  readonly mutex = new Mutex;
  
  fetchLastAssembly(): Assembly | null {
    let asm = window.localStorage.getItem("LAST_ASSEMBLY");
    if (asm) {
      return JSON.parse(asm);
    } else {
      return null;
    }
  }
  storeLastAssembly(assembly: Assembly): void {
    window.localStorage.setItem("LAST_ASSEMBLY", JSON.stringify(assembly));
  }

  getMutex = () => this.mutex;
}