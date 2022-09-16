import { Base64URL } from "../lib/Base64URL";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { MGetSet } from "../lib/MVar";
import { checkListEqual, isDistinct, isOrdered, sortJSON } from "../lib/Utils";
import { GetSet, ObservableVar } from "../lib/Var";
import { IdentityProofStore } from "../services/IdentityProofStore";
import { Harvest } from "./assembly/Harvest";
import { Ballot } from "./Ballot";
import { CryptoUtils, Fingerprint, Me, Signature } from "./Crypto";
import { HarvestResult } from "./HarvestResult";
import { MemberSignature } from "./Member";
import { Question } from "./Question";

export type Proof = {
  harvest: Harvest;
  hashes: string[];
};

export type StoredBallot = {
  id: string;
  question: Question | null;
  ballot: Ballot;
};

export type HarvestStep =
  | "initial"
  | "ballot"
  | "harvest"
  | "harvesting_hashes"
  | "validating"
  | "valid"
  | "finished";

export class HarvestState {
  private readonly me: Me;
  private readonly identityProofStore: IdentityProofStore;
  private readonly preBallotStore: (
    id: string,
    question: Question | null
  ) => MGetSet<StoredBallot | null>;
  private id: string;
  private question: Question | null;

  private readonly ballotStore: MGetSet<Ballot | null>;

  private _ballot: Ballot | null = null;
  private _harvest: Harvest | null = null;
  private _myHash: string | null = null;
  private _hashes: string[] | null = null;
  private _proof: string | null = null;
  private _myValidation: string | null = null;
  private _validations: MemberSignature[] | null = null;
  private _ballots: Ballot[] | null = null;
  result: ObservableVar<HarvestResult | null> = ObservableVar.fromGetSet(
    GetSet.variable<HarvestResult | null>(null)
  );

  constructor(
    me: Me,
    identityProofStore: IdentityProofStore,
    preBallotStore: (
      id: string,
      question: Question | null
    ) => MGetSet<StoredBallot | null>,
    id: string,
    question: Question | null
  ) {
    this.me = me;
    this.identityProofStore = identityProofStore;
    this.preBallotStore = preBallotStore;
    this.id = id;
    this.question = question;

    this.ballotStore = MGetSet.getterSetter<Ballot | null>(
      async () => {
        try {
          const sb = await this.preBallotStore(this.id, this.question).get();
          if (sb !== null && sb.id === this.id && sb.question === this.question)
            return sb.ballot;
          else return null;
        } catch (e) {
          console.log(`Ballot store error: ${JSON.stringify(e)}`);
          return null;
        }
      },
      async (b: Ballot | null) => {
        if (b === null)
          await this.preBallotStore(this.id, this.question).set(null);
        else
          await this.preBallotStore(this.id, this.question).set({
            id: this.id,
            question: this.question,
            ballot: b,
          });
      }
    );
  }

  private readonly log = (s: string) =>
    console.log(`[${this.me.nickname}] ${s}`);

  readonly reset = async (
    id: string,
    question: Question | null
  ): Promise<boolean> => {
    this.id = id;
    this.question = question;
    this.resetHarvest();
    const b = await this.ballotStore.get();
    this._ballot = b;
    return b !== null;
  };

  readonly resetHarvest = (): void => {
    this._harvest = null;
    this._myHash = null;
    this._hashes = null;
    this._proof = null;
    this._myValidation = null;
    this._validations = null;
    this._ballots = null;
    this.result.set(null);
  };

  readonly step = (): HarvestStep => {
    if (this._ballot === null) return "initial";
    if (this._harvest === null) return "ballot";
    if (this._myHash === null) return "harvest";
    if (this._hashes === null) return "harvesting_hashes";
    if (this._validations === null) return "validating";
    if (this._ballots === null) return "valid";
    return "finished";
  };

  readonly setBallot = async (ballot: Ballot): Promise<void> => {
    if (this._ballot !== null) throw new Error("Ballot already set!");

    this._ballot = ballot;
    return await this.ballotStore.set(ballot);
  };

  readonly setHarvest = (harvest: Harvest): void => {
    if (this._ballot === null)
      throw new Error("Trying to set harvest with no ballot!");

    if (this._ballot.tag !== Harvest.kind(harvest))
      throw new Error(
        `The havest type ${Harvest.kind(harvest)} and my ballot type ${
          this._ballot.tag
        } don't match!`
      );

    if (!isDistinct(harvest.participants))
      throw new Error(`Duplicate participants detected.`);

    if (
      this._hashes === null &&
      harvest.id === this.id &&
      harvest.question === this.question
    ) {
      harvest.participants.sort();
      this._harvest = harvest;
    } else throw new Error("Wrong harvest!");
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
      const clear = await this.me.decrypt(Base64URL.getInstance().decode(p));
      previousHashes.push(Base64URL.getInstance().encode(clear));
    }

    let ballotHash = await CryptoUtils.hash(this._ballot);

    this._myHash = Base64URL.getInstance().encode(ballotHash);

    const l = Array.from(remaining);
    l.reverse();
    for (const m of l) {
      const ip = await this.identityProofStore.fetch(m);
      ballotHash = await ip.encryptIt(ballotHash);
    }

    previousHashes.push(Base64URL.getInstance().encode(ballotHash));
    previousHashes.sort();
    return previousHashes;
  };

  readonly validate = async (hashes: string[]): Promise<Signature> => {
    if (this._hashes !== null) throw new Error("Hashes already set!");

    if (this._ballot === null)
      throw new Error("Trying to set hashes with no ballot!");

    if (this._harvest === null)
      throw new Error("Trying to set hashes with no harvest!");

    if (this._harvest.participants.length !== hashes.length)
      throw new Error("Trying to set hashes, but the sizes don't match!");

    if (this._myHash === null)
      throw new Error("Trying to set hashes before giving my hash!");

    if (!isOrdered(hashes))
      throw new Error("Trying to set hashes, but hashes not ordered!");

    if (hashes.findIndex((x) => x === this._myHash) === -1)
      throw new Error("Trying to set hashes, but my hash is not in it!");

    this._hashes = hashes;

    const proof: Proof = {
      harvest: this._harvest,
      hashes: this._hashes,
    };

    this._proof = JSONNormalizedStringifyD(proof);
    this._myValidation = await this.me.signB64(
      new TextEncoder().encode(this._proof)
    );

    return this._myValidation;
  };

  readonly validity = async (validations: MemberSignature[]): Promise<void> => {
    if (this._validations !== null) throw new Error("Validations already set!");

    if (this._harvest === null)
      throw new Error("Trying to get set validations with no harvest!");

    if (this._proof === null)
      throw new Error("Trying to get set validations with no proof!");

    const participants = new Set(this._harvest.participants);

    for (const ms of validations) {
      if (participants.has(ms.member)) {
        const ip = await this.identityProofStore.fetch(ms.member);
        this.log(
          `Verifying signature ${ms.signature} of member ${ip.nickname.value} for proof ${this._proof}`
        );
        if (await ip.verifySignature(ms.signature, this._proof))
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

  readonly nextBallot = async (
    previous: string[],
    remaining: Fingerprint[]
  ): Promise<string[]> => {
    if (this._ballot === null)
      throw new Error("Trying to give my ballot without a ballot!");

    if (this._harvest === null)
      throw new Error("Trying to give my ballot with no harvest!");

    if (this._hashes === null)
      throw new Error("Trying to give my ballot with no hashes!");

    if (this._validations === null)
      throw new Error("Trying to give my ballot with no validations!");

    if (this._ballots !== null)
      throw new Error(
        "Trying to give my ballot after the harvest is finished!"
      );

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

    let previousBallots: string[] = [];
    for (const p of previous) {
      const clear = await this.me.decrypt(Base64URL.getInstance().decode(p));
      previousBallots.push(Base64URL.getInstance().encode(clear));
    }

    let ballotEnc = new TextEncoder().encode(
      JSONNormalizedStringifyD(this._ballot)
    );
    const l = Array.from(remaining);
    l.reverse();
    for (const m of l) {
      const ip = await this.identityProofStore.fetch(m);
      ballotEnc = await ip.encryptIt(ballotEnc);
    }

    previousBallots.push(Base64URL.getInstance().encode(ballotEnc));
    previousBallots.sort();
    return previousBallots;
  };

  readonly finalBallot = async (previous: string[]): Promise<Ballot[]> => {
    if (this._ballot === null)
      throw new Error("Trying to give my ballot without a ballot!");

    if (this._harvest === null)
      throw new Error("Trying to give my ballot with no harvest!");

    if (this._hashes === null)
      throw new Error("Trying to give my ballot with no hashes!");

    if (this._validations === null)
      throw new Error("Trying to give my ballot with no validations!");

    if (this._ballots !== null)
      throw new Error(
        "Trying to give my ballot after the harvest is finished!"
      );

    if (!isOrdered(previous))
      throw new Error("The previous list is nor ordered!");

    if (previous.length + 1 !== this._harvest.participants.length)
      throw new Error("finalBallot: sizes don't match!");

    let allBallots: Ballot[] = [this._ballot];
    for (const p of previous) {
      const clearBin = await this.me.decrypt(Base64URL.getInstance().decode(p));
      const clearSerial = new TextDecoder("utf-8").decode(clearBin);
      this.log(`Decrypted ballot ${clearSerial}`);
      const clear: Ballot = JSON.parse(clearSerial);
      allBallots.push(clear);
    }

    return sortJSON(allBallots);
  };

  readonly verifyBallots = async (
    ballots: Ballot[]
  ): Promise<HarvestResult> => {
    if (this._ballot === null)
      throw new Error("Trying to verify results without my ballot!");

    const expectedType = this._ballot.tag;

    if (this._harvest === null)
      throw new Error("Trying to verify results with no harvest!");

    if (this._hashes === null)
      throw new Error("Trying to verify results with no hashes!");

    if (this._ballots !== null)
      throw new Error("Trying to verify results of a finished harvest!");

    if (this._harvest.participants.length !== ballots.length)
      throw new Error(
        "Trying to verify results, ballots and participants numbers don't match!"
      );

    if (!ballots.every((x) => x.tag === expectedType))
      throw new Error(`Ballots not of the expected type ${expectedType}`);

    if (ballots.length !== this._hashes.length)
      throw new Error(
        "Trying to verify results, ballots and hashes numbers don't match!"
      );

    if (!isOrdered(ballots.map(JSONNormalizedStringifyD)))
      throw new Error("Trying to verify results, but ballots not ordered!");

    const candidateHashes: string[] = [];
    for (const ballot of ballots)
      candidateHashes.push(
        Base64URL.getInstance().encode(await CryptoUtils.hash(ballot))
      );

    if (!checkListEqual(this._hashes, candidateHashes))
      throw new Error(
        `Verify ballots: Validates hashes and ${JSON.stringify(
          this._hashes
        )} and ballot candidate hashes ${JSON.stringify(
          candidateHashes
        )} are not the same!`
      );

    let result: HarvestResult;

    switch (expectedType) {
      case "question":
        let questions = [];

        for (const ballot of ballots)
          if (ballot.tag === "question" && ballot.question !== null)
            questions.push(ballot.question);

        result = HarvestResult.questions(this._harvest.participants, questions);
        break;
      case "closed_answer":
        if (this.question === null)
          throw new Error(
            "Expected closed answer with an harvest without a question."
          );

        let yes = 0;
        let no = 0;

        for (const ballot of ballots) {
          if (ballot.tag === "closed_answer")
            if (ballot.answer) yes += 1;
            else no += 1;
        }

        result = HarvestResult.closedAnswer(
          this._harvest.participants,
          this.question.message,
          yes,
          no
        );
        break;
      case "open_answer":
        if (this.question === null)
          throw new Error(
            "Expected closed answer with an harvest without a question."
          );

        let answers = [];

        for (const ballot of ballots)
          if (ballot.tag === "open_answer") answers.push(ballot.answer);

        result = HarvestResult.openAnswer(
          this._harvest.participants,
          this.question.message,
          answers
        );
    }
    this._ballots = ballots;
    this.result.set(result);
    return result;
  };
}
