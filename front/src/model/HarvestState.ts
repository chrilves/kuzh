import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { IdentityProofStore } from "../services/IdentityProofStore";
import { Ballot } from "./Ballot";
import { CryptoUtils, Fingerprint, Me, Signature } from "./Crypto";
import { Harvest } from "./assembly/Harvest";
import { MemberSignature } from "./Member";
import { isDistinct, isOrdered } from "../lib/Utils";
import { Base64URL } from "../lib/Base64URL";

export type Proof = {
  harvest: Harvest;
  hashes: string[];
};

export type HarvestStep =
  | "initial"
  | "ballot"
  | "harvest"
  | "hashes"
  | "valid"
  | "finished";

export class HarvestState {
  private readonly me: Me;
  private readonly identityProofStore: IdentityProofStore;
  readonly id: string;
  readonly question: string | null;

  private _ballot: Ballot | null = null;
  private _harvest: Harvest | null = null;
  private _hashes: string[] | null = null;
  private _validations: MemberSignature[] | null = null;
  private _real: Ballot[] | null = null;

  constructor(
    me: Me,
    identityProofStore: IdentityProofStore,
    id: string,
    question: string | null
  ) {
    this.me = me;
    this.identityProofStore = identityProofStore;
    this.id = id;
    this.question = question;
  }

  readonly step = (): HarvestStep => {
    if (this._ballot === null) return "initial";

    if (this._harvest === null) return "ballot";

    if (this._hashes === null) return "harvest";

    if (this._validations === null) return "hashes";

    if (this._real === null) return "valid";

    return "finished";
  };

  readonly setBallot = (ballot: Ballot) => {
    if (this._ballot !== null) throw new Error("Ballot already set!");

    this._ballot = ballot;
  };

  readonly setHarvest = (harvest: Harvest) => {
    if (this._ballot === null)
      throw new Error("Trying to set harvest with no ballot!");

    if (
      (harvest.question !== null && this._ballot.tag === "question") ||
      (harvest.question === null && this._ballot.tag === "answer") ||
      !isDistinct(harvest.participants)
    )
      throw new Error(`Bad harvest`);

    if (
      this._hashes === null &&
      harvest.id === this.id &&
      harvest.question === this.question
    )
      this._harvest = harvest;
    else throw new Error("Wrong harvest!");
  };

  readonly myHash = async (): Promise<string> => {
    if (this._ballot === null)
      throw new Error("Trying to get a hash without a ballot!");

    if (this._harvest === null)
      throw new Error("Trying to get a hash with no harvest!");

    if (this._hashes !== null)
      throw new Error("Trying to get a hash after hashes!");

    return Base64URL.getInstance().encode(await CryptoUtils.hash(this._ballot));
  };

  readonly nextHash = async (
    previous: string[],
    remaining: Fingerprint[]
  ): Promise<string[]> => {
    if (this._ballot === null)
      throw new Error("Trying to give my hash without a ballot!");

    if (this._harvest === null)
      throw new Error("Trying to give my hash with no harvest!");

    if (this._hashes !== null)
      throw new Error("Trying to give my hash after hashes!");

    if (!isOrdered(previous))
      throw new Error("The previous list is nor ordered!");

    if (!isDistinct(remaining))
      throw new Error("nextHash: remaining is not distinct!");

    if (
      previous.length + remaining.length + 1 !==
      this._harvest.participants.length
    )
      throw new Error("nextHash: sizes don't match!");

    for (const m of remaining)
      if (this._harvest.participants.findIndex((x) => x === m) === -1)
        throw new Error(`nextHash: member ${m} not a participant!`);

    let previousHashes: string[] = [];
    for (const p of previous) {
      const clear = await this.me.decryptBallot(p);
      previousHashes.push(clear);
    }

    let ballotHash = await CryptoUtils.hash(this._ballot);
    const l = Array.from(remaining);
    l.reverse();
    for (const m of l) {
      const ip = await this.identityProofStore.fetch(m);
      ballotHash = await ip.encryptBallot(ballotHash);
    }

    previousHashes.push(Base64URL.getInstance().encode(ballotHash));
    previousHashes.sort();
    return previousHashes;
  };

  readonly setHashes = async (hashes: string[]): Promise<Signature> => {
    if (this._hashes !== null) throw new Error("Hashes already set!");

    if (this._ballot === null)
      throw new Error("Trying to set hashes with no ballot!");

    if (this._harvest === null)
      throw new Error("Trying to set hashes with no harvest!");

    if (this._harvest.participants.length !== hashes.length)
      throw new Error("Trying to set hashes, but the sizes don't match!");

    const hash = await this.myHash();

    if (hashes.findIndex((x) => x === hash) === -1)
      throw new Error("Trying to set hashes, but my hash is not in it!");

    this._hashes = hashes;

    return await this.myValidation();
  };

  private readonly proof = async (): Promise<string> => {
    if (this._harvest === null)
      throw new Error("Trying to get my validation with no harvest!");

    if (this._hashes === null)
      throw new Error("Trying to get my validation with no hashes!");

    const proof: Proof = {
      harvest: this._harvest,
      hashes: this._hashes,
    };

    return JSONNormalizedStringifyD(proof);
  };

  readonly myValidation = async (): Promise<Signature> =>
    await this.me.signB64(new TextEncoder().encode(await this.proof()));

  readonly setValidations = async (
    validations: MemberSignature[]
  ): Promise<void> => {
    if (this._validations !== null) throw new Error("Validations already set!");

    if (this._harvest === null)
      throw new Error("Trying to get set validations with no harvest!");

    const participants = new Set(this._harvest.participants);

    const message = JSONNormalizedStringifyD(await this.proof());

    for (const ms of validations) {
      if (participants.has(ms.member)) {
        const ip = await this.identityProofStore.fetch(ms.member);
        if (await ip.verifySignature(message, ms.signature))
          participants.delete(ms.member);
        else throw new Error(`Wrong signature for user ${ms.member}`);
      } else throw new Error(`Validations with not participant ${ms.member}`);
    }

    if (participants.size === 0) this._validations = validations;
    else
      throw new Error(
        `No signature found for participants ${JSON.stringify(
          Array.from(participants)
        )}`
      );
  };
}
