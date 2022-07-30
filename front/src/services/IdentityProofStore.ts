import { BackAPI } from "./BackAPI";
import { Fingerprint, IdentityProof } from "../model/Crypto";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { AssemblyInfo } from "../model/AssembyInfo";

export interface IdentityProofStore {
  fetch(member: Fingerprint): Promise<IdentityProof>;
}

export interface IdentityProofStoreFactory {
  identityProofStore(assemblyInfo: AssemblyInfo): IdentityProofStore;
}

export class BackCachingIdentityProofStore implements IdentityProofStore {
  private readonly backAPI: BackAPI;
  private readonly assemblyInfo: AssemblyInfo;
  private readonly localStorageKey: string;
  private store = new Map<Fingerprint, IdentityProof>();

  constructor(backAPI: BackAPI, assemblyInfo: AssemblyInfo) {
    this.backAPI = backAPI;
    this.assemblyInfo = assemblyInfo;
    this.localStorageKey = `IDENITY_PROFS_${assemblyInfo.id}`;
    this.fetch = this.fetch.bind(this);

    const saved = window.localStorage.getItem(this.localStorageKey);
    if (saved) {
      for (const id of JSON.parse(saved)) this.store.set(id.fingerprint, id);
    }
  }

  async fetch(member: Fingerprint): Promise<IdentityProof> {
    let id = this.store.get(member);
    if (id) {
      return id;
    } else {
      const id = await this.backAPI.identityProof(this.assemblyInfo, member);
      this.store.set(id.fingerprint, id);

      const ids: IdentityProof[] = Array.from(this.store.values());
      const value = JSONNormalizedStringifyD(ids);
      window.localStorage.setItem(this.localStorageKey, value);

      return id;
    }
  }
}

export class BackCachingIdentityProofStoreFactory
  implements IdentityProofStoreFactory
{
  private readonly backAPI: BackAPI;

  constructor(backAPI: BackAPI) {
    this.backAPI = backAPI;
    this.identityProofStore = this.identityProofStore.bind(this);
  }

  identityProofStore(assemblyInfo: AssemblyInfo): IdentityProofStore {
    return new BackCachingIdentityProofStore(this.backAPI, assemblyInfo);
  }
}
