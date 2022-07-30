import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Membership } from "../model/Crypto";

export interface StorageAPI {
  fetchLastMembership(): Promise<Membership | null>;
  storeLastMembership(assembly: Membership): Promise<void>;
}

const localStorageKey = "LAST_MEMBERSHIP";

export class LocalStorageAPI implements StorageAPI {
  fetchLastMembership(): Promise<Membership | null> {
    let asm = window.localStorage.getItem(localStorageKey);
    if (asm) {
      return Membership.fromJson(JSON.parse(asm));
    } else {
      return Promise.resolve(null);
    }
  }
  async storeLastMembership(membership: Membership): Promise<void> {
    return window.localStorage.setItem(
      localStorageKey,
      JSONNormalizedStringifyD(await membership.toJson())
    );
  }
}
