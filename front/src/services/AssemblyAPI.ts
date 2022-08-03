import { Mutex } from "async-mutex";
import { BackAPI } from "./BackAPI";
import { Me, Membership } from "../model/Crypto";
import { StorageAPI } from "./StorageAPI";
import { Operation } from "../model/Operation";
import { AssemblyEvent } from "../model/events/AssemblyEvent";
import ConnectionController from "../model/ConnectionController";
import { ConnectionEvent } from "../model/events/ConnectionEvent";

export interface AssemblyAPI {
  create(assemblyName: string, nickname: string): Promise<Membership>;
  join(id: string, secret: string, nickname: string): Promise<Membership>;
  connect(
    membership: Membership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController>;
}

export namespace AssemblyAPI {
  export function fold(
    assemblyAPI: AssemblyAPI
  ): (operation: Operation) => Promise<Membership> {
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

  create(assemblyName: string, nickname: string): Promise<Membership> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.create(assemblyName, nickname)
    );
  }

  join(id: string, secret: string, nickname: string): Promise<Membership> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.join(id, secret, nickname)
    );
  }

  connect(
    membership: Membership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    return this.mutex.runExclusive(() =>
      this.baseAPI.connect(membership, updateAssembly, updateConnection)
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

  async create(assemblyName: string, nickname: string): Promise<Membership> {
    const assembly = await this.backAPI.createAssembly(assemblyName);
    const me = await Me.generate(nickname);
    const membership = new Membership(assembly, me);
    await this.storageAPI.storeLastMembership(membership);
    return membership;
  }

  async join(
    id: string,
    secret: string,
    nickname: string
  ): Promise<Membership> {
    let membership: Membership;

    const last = await this.storageAPI.fetchLastMembership();
    if (last && last.assembly.id === id) {
      membership = last;
    } else {
      const assemblyName = await this.backAPI.assemblyName(id, secret);
      if (assemblyName) {
        const assembly = {
          id: id,
          secret: secret,
          name: assemblyName,
        };
        const me = await Me.generate(nickname);
        membership = new Membership(assembly, me);
      } else {
        throw new Error(
          `The assembly ${id} does not exist or the secret is wrong.`
        );
      }
    }

    await this.storageAPI.storeLastMembership(membership);
    return membership;
  }

  async connect(
    membership: Membership,
    updateAssembly: (state: AssemblyEvent) => void,
    updateConnection: (event: ConnectionEvent) => void
  ): Promise<ConnectionController> {
    return await this.backAPI.connect(
      membership,
      updateAssembly,
      updateConnection
    );
  }
}
