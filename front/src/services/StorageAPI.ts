import { Mutex } from "async-mutex";
import {
  Membership,
  CryptoMembership,
  Serial,
  SerializedMembership,
} from "../model/Crypto";

export interface StorageAPI {
  fetchLastCryptoMembership(): Promise<CryptoMembership | null>;
  storeLastCryptoMembership(assembly: CryptoMembership): Promise<void>;
  getMutex(): Mutex;
}

const localStorageKey = "LAST_MEMBERSHIP";

export class LocalStorageAPI implements StorageAPI {
  readonly mutex = new Mutex();

  fetchLastCryptoMembership(): Promise<CryptoMembership | null> {
    let asm = window.localStorage.getItem(localStorageKey);
    if (asm) {
      return (
        Membership.fromJson(JSON.parse(asm)) as SerializedMembership
      ).map_async(Serial.deSerializeCryptoKey);
    } else {
      return Promise.resolve(null);
    }
  }
  async storeLastCryptoMembership(membership: CryptoMembership): Promise<void> {
    const serialized = await membership.map_async(Serial.serializeCryptoKey);
    return window.localStorage.setItem(
      localStorageKey,
      JSON.stringify(serialized.toJson())
    );
  }

  getMutex = () => this.mutex;
}
