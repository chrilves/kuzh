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

  fetchNickname(): string | null;
  storeNickname(nickname: string): void;

  autoConfirm: GetSet<boolean>;
  autoAccept: GetSet<boolean>;
  disableBlocking: GetSet<boolean>;
}

const localStoragePrefix = "kuzh.cc/";

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
    return `${localStoragePrefix}assembly/${assemblyInfo.id}/identity-proofs`;
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

  readonly fetchNickname = (): string | null => this.nickname;

  readonly storeNickname = (nickname: string): void => {
    this.nickname = nickname;
  };

  readonly autoConfirm: GetSet<boolean> = GetSet.variable(true);
  readonly autoAccept: GetSet<boolean> = GetSet.variable(true);
  readonly disableBlocking: GetSet<boolean> = GetSet.variable(true);
}
