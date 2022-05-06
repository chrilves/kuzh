import { BackAPI } from "./BackAPI";
import { Fingerprint, IdentityProof } from "../model/Crypto";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { StorageAPI } from "./StorageAPI";
import { Mutex } from "async-mutex";

export interface IdentityProofStore {
  fetch(member: Fingerprint): Promise<IdentityProof>;
}

export interface IdentityProofStoreFactory {
  identityProofStore(assemblyInfo: AssemblyInfo): IdentityProofStore;
}

export class BackCachingIdentityProofStore implements IdentityProofStore {
  private readonly storageAPI: StorageAPI;
  private readonly backAPI: BackAPI;
  private readonly assemblyInfo: AssemblyInfo;
  private readonly store = new Map<Fingerprint, IdentityProof>();
  private readonly mutex: Mutex = new Mutex();
  private readonly mutexes: Map<Fingerprint, Mutex> = new Map();

  constructor(
    storageAPI: StorageAPI,
    backAPI: BackAPI,
    assemblyInfo: AssemblyInfo
  ) {
    this.storageAPI = storageAPI;
    this.backAPI = backAPI;
    this.assemblyInfo = assemblyInfo;
    this.fetch = this.fetch.bind(this);

    (async () => {
      for (const identityProof of await storageAPI.fetchIdentityProofs(
        assemblyInfo
      ))
        this.store.set(identityProof.fingerprint, identityProof);
    })();
  }

  readonly fetch = async (member: Fingerprint): Promise<IdentityProof> => {
    let id = this.store.get(member);
    if (id) return id;

    let memberMutex = this.mutexes.get(member);
    if (memberMutex === undefined) {
      memberMutex = new Mutex();
      this.mutexes.set(member, memberMutex);
    }

    return memberMutex.runExclusive(async () => {
      let id = this.store.get(member);
      if (id) return id;
      else {
        id = await this.backAPI.identityProof(this.assemblyInfo, member);
        this.store.set(id.fingerprint, id);
        this.mutexes.delete(member);
        await this.storageAPI.storeIdentityProofs(
          this.assemblyInfo,
          Array.from(this.store.values())
        );
        return id;
      }
    });
  };
}

export class BackCachingIdentityProofStoreFactory
  implements IdentityProofStoreFactory
{
  private readonly storageAPI: StorageAPI;
  private readonly backAPI: BackAPI;

  constructor(storageAPI: StorageAPI, backAPI: BackAPI) {
    this.storageAPI = storageAPI;
    this.backAPI = backAPI;
  }

  readonly identityProofStore = (
    assemblyInfo: AssemblyInfo
  ): IdentityProofStore =>
    new BackCachingIdentityProofStore(
      this.storageAPI,
      this.backAPI,
      assemblyInfo
    );
}
