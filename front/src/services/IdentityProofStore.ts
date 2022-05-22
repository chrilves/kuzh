import { Assembly } from "../model/Assembly";
import { BackAPI } from "./BackAPI";
import { AssemblyInfo, Fingerprint, IdentityProof } from "../model/Crypto";

export interface IdentityProofStore {
  fetch(member: Set<Fingerprint>): Promise<[IdentityProof]>;
  fetchOne(member: Fingerprint): Promise<IdentityProof>;
}

export class BackCachingIdentityProofStore {
  readonly backAPI: BackAPI;
  readonly assemblyInfo: AssemblyInfo;
  readonly localStorageKey: string;
  store = new Map<Fingerprint, IdentityProof>();

  constructor(backAPI: BackAPI, assemblyInfo: AssemblyInfo) {
    this.backAPI = backAPI;
    this.assemblyInfo = assemblyInfo;
    this.localStorageKey = `IDENITY_PROFS_${assemblyInfo.uuid}`;
    this.fetch = this.fetch.bind(this);

    const saved = window.localStorage.getItem(this.localStorageKey);
    if (saved) {
      console.log(`Restoring local storage ${saved}`);
      for (const id of JSON.parse(saved)) {
        console.log(`Restoring member ${id.fingerprint}`);
        this.store.set(id.fingerprint, id);
      }
    }
  }

  async fetch(members: Set<Fingerprint>): Promise<IdentityProof[]> {
    let result: IdentityProof[] = [];
    let toFetch: Set<Fingerprint> = new Set();

    members.forEach((member) => {
      let id = this.store.get(member);
      if (id === undefined) {
        toFetch.add(member);
      } else {
        result.push(id);
      }
    });

    const ids = await this.backAPI.identityProofs(this.assemblyInfo, toFetch);
    for (const id of ids) {
      this.store.set(id.fingerprint, id);
      result.push(id);
    }

    if (toFetch.size != 0) {
      const ids: IdentityProof[] = Array.from(this.store.values());
      const value = JSON.stringify(ids);
      console.log(`Saving members ${value}`);
      window.localStorage.setItem(this.localStorageKey, value);
    }

    return result;
  }

  async fetchOne(member: Fingerprint): Promise<IdentityProof> {
    const res = await this.fetch(new Set([member]));
    return res[0];
  }
}
