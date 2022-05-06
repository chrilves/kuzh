import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
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
}

const localStorageMembershipKey = "LAST_MEMBERSHIP";
const localStorageNicknameKey = "LAST_NICKNAME";

export class LocalStorageAPI implements StorageAPI {
  fetchLastMembership(): Promise<Membership | null> {
    let asm = window.localStorage.getItem(localStorageMembershipKey);
    if (asm) {
      return Membership.fromJson(JSON.parse(asm));
    } else {
      return Promise.resolve(null);
    }
  }
  async storeLastMembership(membership: Membership): Promise<void> {
    return window.localStorage.setItem(
      localStorageMembershipKey,
      JSONNormalizedStringifyD(await membership.toJson())
    );
  }

  private localStorageIdentityProofsKey(assemblyInfo: AssemblyInfo): string {
    return `IDENITY_PROFS_${assemblyInfo.id}`;
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
}
