import { Base64URL } from "../lib/Base64URL";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { GetSet } from "../lib/Var";
import { AssemblyInfo } from "../model/assembly/AssembyInfo";
import { IdentityProof, Membership } from "../model/Crypto";

export interface StorageAPI {
  fetchLastMembership(): Promise<Membership | null>;
  storeLastMembership(assembly: Membership): Promise<void>;

  fetchIdentityProofs(assemblyInfo: AssemblyInfo): Promise<IdentityProof[]>;
  storeIdentityProofs(
    assemblyInfo: AssemblyInfo,
    identityProofs: IdentityProof[]
  ): Promise<void>;

  fetchBallot(assemblyInfo: AssemblyInfo): Uint8Array | null;
  storeBallot(assemblyInfo: AssemblyInfo, ballot: Uint8Array | null): void;

  clearPrivateData(): void;

  fetchNickname(): string | null;
  storeNickname(nickname: string): void;

  autoConfirm: GetSet<boolean>;
  autoAccept: GetSet<boolean>;
  disableBlocking: GetSet<boolean>;
}

const localStoragePrefix = "kuzh.cc/";
const localStorageAssemblyPrefix = `${localStoragePrefix}assembly/`;

const localStorageMembershipKey = `${localStoragePrefix}last-membership`;
const localStorageNicknameKey = `${localStoragePrefix}nickname`;
const localStorageAutoConfirmKey = `${localStoragePrefix}auto-confirm`;
const localStorageAutoValidateKey = `${localStoragePrefix}auto-validate`;
const localStorageEnableBlockingKey = `${localStoragePrefix}enable-blocking`;

export class LocalStorageAPI implements StorageAPI {
  async fetchLastMembership(): Promise<Membership | null> {
    let asm = window.localStorage.getItem(localStorageMembershipKey);
    try {
      if (asm) {
        return await Membership.fromJson(JSON.parse(asm));
      } else {
        return null;
      }
    } catch (e) {
      window.localStorage.removeItem(localStorageMembershipKey);
      console.log(`Error while fetching last membership: ${JSON.stringify(e)}`);
      return null;
    }
  }

  async storeLastMembership(membership: Membership): Promise<void> {
    return window.localStorage.setItem(
      localStorageMembershipKey,
      JSONNormalizedStringifyD(await membership.toJson())
    );
  }

  private localStorageIdentityProofsKey(assemblyInfo: AssemblyInfo): string {
    return `${localStorageAssemblyPrefix}${assemblyInfo.id}/identity-proofs`;
  }

  private localStorageBallotKey(assemblyInfo: AssemblyInfo): string {
    return `${localStorageAssemblyPrefix}${assemblyInfo.id}/ballot`;
  }

  readonly fetchIdentityProofs = async (
    assemblyInfo: AssemblyInfo
  ): Promise<IdentityProof[]> => {
    const saved = window.localStorage.getItem(
      this.localStorageIdentityProofsKey(assemblyInfo)
    );
    let identityProofs: IdentityProof[] = [];
    if (saved) {
      for (const json of JSON.parse(saved)) {
        const ip = await IdentityProof.fromJson(json);
        identityProofs.push(ip);
      }
    }
    return identityProofs;
  };

  readonly storeIdentityProofs = async (
    assemblyInfo: AssemblyInfo,
    identityProofs: IdentityProof[]
  ): Promise<void> => {
    let jsonIdentityProofs = [];
    for (const ip of identityProofs) jsonIdentityProofs.push(await ip.toJson());
    const value = JSON.stringify(jsonIdentityProofs);
    window.localStorage.setItem(
      this.localStorageIdentityProofsKey(assemblyInfo),
      value
    );
  };

  readonly fetchBallot = (assemblyInfo: AssemblyInfo): Uint8Array | null => {
    try {
      const ballot = window.localStorage.getItem(
        this.localStorageBallotKey(assemblyInfo)
      );
      if (ballot === null) return null;
      else return Base64URL.getInstance().decode(ballot);
    } catch (e) {
      console.log(`Error while fetching ballot: ${JSON.stringify(e)}`);
      window.localStorage.removeItem(this.localStorageBallotKey(assemblyInfo));
      return null;
    }
  };

  readonly storeBallot = (
    assemblyInfo: AssemblyInfo,
    ballot: Uint8Array | null
  ): void => {
    if (ballot === null)
      window.localStorage.removeItem(this.localStorageBallotKey(assemblyInfo));
    else
      window.localStorage.setItem(
        this.localStorageBallotKey(assemblyInfo),
        Base64URL.getInstance().encode(ballot)
      );
  };

  readonly clearPrivateData = (): void => {
    const toRemoveKeys: Set<string> = new Set();
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        (key !== null && key.startsWith(localStorageAssemblyPrefix)) ||
        key === localStorageMembershipKey
      )
        toRemoveKeys.add(key);
    }
    toRemoveKeys.forEach((k) => window.localStorage.removeItem(k));
  };

  readonly fetchNickname = (): string | null =>
    window.localStorage.getItem(localStorageNicknameKey);

  readonly storeNickname = (nickname: string): void => {
    window.localStorage.setItem(localStorageNicknameKey, nickname);
  };

  private readonly booleanProperty = (name: string, dft: boolean) =>
    GetSet.cache(
      GetSet.getterSetter<boolean>(
        () => {
          const value = window.localStorage.getItem(name);
          return value === null ? dft : JSON.parse(value);
        },
        (newValue: boolean) =>
          window.localStorage.setItem(name, JSON.stringify(newValue))
      )
    );

  readonly autoConfirm: GetSet<boolean> = this.booleanProperty(
    localStorageAutoConfirmKey,
    true
  );
  readonly autoAccept: GetSet<boolean> = this.booleanProperty(
    localStorageAutoValidateKey,
    true
  );
  readonly disableBlocking: GetSet<boolean> = this.booleanProperty(
    localStorageEnableBlockingKey,
    true
  );
}

export class DummyStorageAPI implements StorageAPI {
  private membership: Membership | null = null;
  private identityProofs: Map<string, IdentityProof[]> = new Map();
  private ballots: Map<string, Uint8Array> = new Map();
  private nickname: string | null = null;

  readonly fetchLastMembership = async (): Promise<Membership | null> =>
    this.membership;

  readonly storeLastMembership = async (
    membership: Membership
  ): Promise<void> => {
    this.membership = membership;
  };

  readonly fetchIdentityProofs = async (
    assemblyInfo: AssemblyInfo
  ): Promise<IdentityProof[]> => {
    const ids = this.identityProofs.get(assemblyInfo.id);
    if (ids !== undefined) return ids;
    else return [];
  };

  readonly storeIdentityProofs = async (
    assemblyInfo: AssemblyInfo,
    identityProofs: IdentityProof[]
  ): Promise<void> => {
    this.identityProofs.set(assemblyInfo.id, identityProofs);
  };

  readonly fetchBallot = (assemblyInfo: AssemblyInfo): Uint8Array | null => {
    const ballot = this.ballots.get(assemblyInfo.id);
    if (ballot === undefined) return null;
    return ballot;
  };

  readonly storeBallot = (
    assemblyInfo: AssemblyInfo,
    ballot: Uint8Array | null
  ): void => {
    if (ballot === null) this.ballots.delete(assemblyInfo.id);
    else this.ballots.set(assemblyInfo.id, ballot);
  };

  readonly clearPrivateData = (): void => {
    this.ballots.clear();
    this.identityProofs.clear();
    this.membership = null;
  };

  readonly fetchNickname = (): string | null => this.nickname;

  readonly storeNickname = (nickname: string): void => {
    this.nickname = nickname;
  };

  readonly autoConfirm: GetSet<boolean> = GetSet.variable(true);
  readonly autoAccept: GetSet<boolean> = GetSet.variable(true);
  readonly disableBlocking: GetSet<boolean> = GetSet.variable(true);
}
