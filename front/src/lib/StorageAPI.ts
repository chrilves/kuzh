import { Mutex } from "async-mutex";
import { Membership } from "./Model"; 

export interface StorageAPI {
  fetchLastMembership(): Promise<Membership | null>
  storeLastMembership(assembly: Membership): Promise<void>
  getMutex(): Mutex
}

export class LocalStorageAPI implements StorageAPI {
  readonly mutex = new Mutex;
  
  fetchLastMembership(): Membership | null {
    let asm = window.localStorage.getItem("LAST_ASSEMBLY");
    if (asm) {
      return JSON.parse(asm);
    } else {
      return null;
    }
  }
  async storeLastMembership(membership: Membership): Promise<void> {
    const json = await Membership.serialize(membership);
    return window.localStorage.setItem("LAST_MEMBERSHIP", JSON.stringify(json));
  }

  getMutex = () => this.mutex;
}