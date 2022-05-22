import { Mutex } from "async-mutex";
import { BackAPI } from "./BackAPI";
import { CryptoMe, CryptoMembership, Membership } from "../model/Crypto";
import { StorageAPI } from "./StorageAPI";

export interface AssemblyAPI {
  create(assemblyName: string, nickname: string): Promise<CryptoMembership>;
  join(
    uuid: string,
    secret: string,
    nickname: string
  ): Promise<CryptoMembership>;
  connect(cryptoMembership: CryptoMembership): Promise<void>;
}

export class MutexedAssemblyAPI implements AssemblyAPI {
  readonly mutex: Mutex;
  readonly baseAPI: AssemblyAPI;

  constructor(baseAPI: AssemblyAPI) {
    this.mutex = new Mutex();
    this.baseAPI = baseAPI;
    this.create = this.create.bind(this);
    this.join = this.join.bind(this);
  }

  create(assemblyName: string, nickname: string): Promise<CryptoMembership> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.create(assemblyName, nickname)
    );
  }

  join(
    uuid: string,
    secret: string,
    nickname: string
  ): Promise<CryptoMembership> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.join(uuid, secret, nickname)
    );
  }

  connect(cryptoMembership: CryptoMembership): Promise<void> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.connect(cryptoMembership)
    );
  }
}

export class RealAssemblyAPI implements AssemblyAPI {
  readonly storageAPI: StorageAPI;
  readonly backAPI: BackAPI;

  constructor(storageApi: StorageAPI, backAPI: BackAPI) {
    this.storageAPI = storageApi;
    this.backAPI = backAPI;
    this.create = this.create.bind(this);
    this.join = this.join.bind(this);
    this.connect = this.connect.bind(this);
  }

  async create(
    assemblyName: string,
    nickname: string
  ): Promise<CryptoMembership> {
    console.log(`Creating assembly ${assemblyName} for ${nickname}`);
    const assembly = await this.backAPI.createAssembly(assemblyName);
    console.log(`[OK] Successfully created assembly ${assembly.uuid}.`);
    const me = await CryptoMe.generate(nickname);
    const cryptoMembership = new Membership(assembly, me);
    await this.storageAPI.storeLastCryptoMembership(cryptoMembership);
    return cryptoMembership;
  }

  async join(
    uuid: string,
    secret: string,
    nickname: string
  ): Promise<CryptoMembership> {
    let cryptoMembership: CryptoMembership;

    const last = await this.storageAPI.fetchLastCryptoMembership();
    if (last && last.assembly.uuid === uuid) {
      cryptoMembership = last;
    } else {
      console.log("Getting assembly name");
      const assemblyName = await this.backAPI.assemblyName(uuid, secret);
      if (assemblyName) {
        console.log("Generating a new identity");
        const assembly = {
          uuid: uuid,
          secret: secret,
          name: assemblyName,
        };
        const me = await CryptoMe.generate(nickname);
        cryptoMembership = new Membership(assembly, me);
      } else {
        throw new Error(
          `The assembly ${uuid} does not exist or the secret is wrong.`
        );
      }
    }

    await this.storageAPI.storeLastCryptoMembership(cryptoMembership);
    return cryptoMembership;
  }

  async connect(cryptoMembership: CryptoMembership): Promise<void> {
    /*
    console.log(`Creating identity proof in assembly ${assemblyName} for ${nickname}`);
    const identityProof = await CryptoMe.identityProof(cryptoMembership.me);
    
    console.log(`Verifying identity proof in assembly ${assemblyName} for ${nickname}`);
    await CryptoMe.verifyIdentityProof(identityProof);
    
    if (novel) {
      console.log(`Storing new membership.`);
      await this.storageAPI.storeLastCryptoMembership(cryptoMembership);
    }

    
    const identityProof = await CryptoMe.identityProof(cryptoMembership.me);
    await CryptoMe.verifyIdentityProof(identityProof);
    await this.storageAPI.storeLastCryptoMembership(cryptoMembership);*/

    await this.backAPI.connect(cryptoMembership, (x) => {});
    return;
  }
}
