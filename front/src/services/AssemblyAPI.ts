import { Mutex } from "async-mutex";
import { BackAPI } from "./BackAPI";
import { CryptoMe, CryptoMembership, Membership } from "../model/Crypto";
import { StorageAPI } from "./StorageAPI";
import { Operation } from "../model/Operation";
import Assembly from "../model/Assembly";
import { AssemblyEvent } from "../model/PublicEvent";
import ConnectionController from "../model/ConnectionController";
import { ConnectionEvent } from "../model/ConnectionEvent";

export interface AssemblyAPI {
  create(assemblyName: string, nickname: string): Promise<CryptoMembership>;
  join(id: string, secret: string, nickname: string): Promise<CryptoMembership>;
  connect(
    cryptoMembership: CryptoMembership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController>;
}

export namespace AssemblyAPI {
  export function fold(
    assemblyAPI: AssemblyAPI
  ): (operation: Operation) => Promise<CryptoMembership> {
    return async function (operation: Operation) {
      switch (operation.tag) {
        case "join":
          return await assemblyAPI.join(
            operation.id,
            operation.secret,
            operation.nickname
          );
        case "create":
          return await assemblyAPI.create(
            operation.assemblyName,
            operation.nickname
          );
      }
    };
  }
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
    id: string,
    secret: string,
    nickname: string
  ): Promise<CryptoMembership> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.join(id, secret, nickname)
    );
  }

  connect(
    cryptoMembership: CryptoMembership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.connect(cryptoMembership, updateAssembly, updateConnection)
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
    console.log(`[OK] Successfully created assembly ${assembly.id}.`);
    const me = await CryptoMe.generate(nickname);
    const cryptoMembership = new Membership(assembly, me);
    await this.storageAPI.storeLastCryptoMembership(cryptoMembership);
    return cryptoMembership;
  }

  async join(
    id: string,
    secret: string,
    nickname: string
  ): Promise<CryptoMembership> {
    let cryptoMembership: CryptoMembership;

    const last = await this.storageAPI.fetchLastCryptoMembership();
    if (last && last.assembly.id === id) {
      cryptoMembership = last;
    } else {
      console.log("Getting assembly name");
      const assemblyName = await this.backAPI.assemblyName(id, secret);
      if (assemblyName) {
        console.log("Generating a new identity");
        const assembly = {
          id: id,
          secret: secret,
          name: assemblyName,
        };
        const me = await CryptoMe.generate(nickname);
        cryptoMembership = new Membership(assembly, me);
      } else {
        throw new Error(
          `The assembly ${id} does not exist or the secret is wrong.`
        );
      }
    }

    await this.storageAPI.storeLastCryptoMembership(cryptoMembership);
    return cryptoMembership;
  }

  async connect(
    cryptoMembership: CryptoMembership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    return await this.backAPI.connect(
      cryptoMembership,
      updateAssembly,
      updateConnection
    );
  }
}
