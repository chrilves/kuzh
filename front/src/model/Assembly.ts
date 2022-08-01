import {
  IdentityProofStore,
  IdentityProofStoreFactory,
} from "../services/IdentityProofStore";
import { PublicEvent } from "./PublicEvent";
import { Membership, Fingerprint, Name } from "./Crypto";
import { AssemblyState } from "./AssemblyState";
import { Member, MemberReadiness } from "./Member";
import { ChoiceStatus } from "./ChoiceStatus";
import { AssemblyAPI } from "../services/AssemblyAPI";
import { ConnectionEvent } from "./ConnectionEvent";
import ConnectionController from "./ConnectionController";
import { AssemblyEvent } from "./AssemblyEvent";
import { MemberEvent } from "./MemberEvent";
import { JSONNormalizedStringify } from "../lib/JSONNormalizedStringify";
import { Harvest } from "./Harvest";
import { Mutex } from "async-mutex";

export declare function structuredClone(value: any): any;

export type Listerner = {
  state: (state: AssemblyState) => void;
  failure: (reason: string) => void;
  connection: (status: string) => void;
};

export type RunningStatus = "stopped" | "starting" | "started" | "stopping";

export default class Assembly {
  private readonly minParticipants = 3;

  // Services
  private readonly _identityProofStore: IdentityProofStore;
  private readonly _assemblyAPI: AssemblyAPI;

  // Connection Details
  readonly membership: Membership;

  // Connection Handling
  private _listeners: Listerner[] = [];
  private _runningStatus: RunningStatus = "stopped";
  private _connectionController: ConnectionController | null = null;

  // Assembly Management
  private _choiceStatus: ChoiceStatus = ChoiceStatus.noChoice;
  private _state: AssemblyState = {
    questions: [],
    presences: [],
    status: AssemblyState.Status.waiting("", null, []),
  };
  private readonly mutex = new Mutex();

  constructor(
    identityProofStoreFactory: IdentityProofStoreFactory,
    assemblyAPI: AssemblyAPI,
    membership: Membership
  ) {
    this._identityProofStore = identityProofStoreFactory.identityProofStore(
      membership.assembly
    );
    this._assemblyAPI = assemblyAPI;
    this.membership = membership;
  }

  /////////////////////////////////
  // Listerners

  readonly addListener = (f: Listerner) => {
    for (const g of this._listeners) if (f === g) return;
    this._listeners.push(f);
    f.state(this._state);
  };

  readonly removeListener = (f: Listerner) => {
    let l = [];
    for (const g of this._listeners) if (f !== g) l.push(g);
    this._listeners = l;
  };

  readonly clearListeners = () => {
    this._listeners = [];
  };

  private readonly propagateState = () => {
    const clone = structuredClone(this._state);
    for (const l of this._listeners) {
      try {
        l.state(clone);
      } catch (e) {
        console.log(
          `Propagate state error ${e} on state ${JSONNormalizedStringify(
            clone
          )}`
        );
      }
    }
  };

  private readonly propagateFailure = (reason: string) => {
    for (const l of this._listeners)
      try {
        l.failure(reason);
      } catch (e) {
        console.log(`Propagate error error ${e} on reason ${reason}`);
      }
  };

  private readonly propagateConnectionStatus = (status: string) => {
    for (const l of this._listeners)
      try {
        l.connection(status);
      } catch (e) {
        console.log(
          `Propagate connection status error ${e} on status ${status}`
        );
      }
  };

  ////////////////////////////////////////
  // Running

  readonly runningStatus = (): RunningStatus => this._runningStatus;

  readonly start = () => {
    this.mutex.runExclusive(async () => {
      if (this._runningStatus === "stopped") {
        this._runningStatus = "starting";
        this._connectionController = await this._assemblyAPI.connect(
          this.membership,
          this.updateState,
          this.updateConnection
        );
        this._runningStatus = "started";
      }
    });
  };

  readonly stop = () => {
    this.mutex.runExclusive(async () => {
      if (this._runningStatus === "started") {
        this._runningStatus = "stopping";
        if (this._connectionController) this._connectionController.close();
        this._runningStatus = "stopped";
      }
    });
  };

  ////////////////////////////////////////
  // Getters

  readonly name = async (member: Fingerprint): Promise<Name> =>
    (await this._identityProofStore.fetch(member)).nickname.value;

  ///////////////////////////////////////
  // Question Management

  readonly myQuestion = (question: string | null) => {
    switch (this._state.status.tag) {
      case "waiting":
        this._choiceStatus = ChoiceStatus.question(
          this._state.status.id,
          question,
          "ready"
        );
        this.send(MemberEvent.blocking("ready"));
        break;
      default:
        throw new Error("Trying to choose when harvesting???");
    }
  };

  readonly myAnswer = (answer: boolean) => {
    switch (this._state.status.tag) {
      case "waiting":
        this._choiceStatus = ChoiceStatus.answer(
          this._state.status.id,
          answer,
          "ready"
        );
        this.send(MemberEvent.blocking("ready"));
        break;
      default:
        throw new Error("Trying to choose when harvesting???");
    }
  };

  readonly acceptHarvest = () => {
    this.send(MemberEvent.acceptHarvest);
  };

  readonly canRefuse = (member: Fingerprint): boolean => {
    switch (this._state.status.tag) {
      case "proposed":
        const idxParticipant =
          this._state.status.harvest.participants.findIndex(
            (x) => x === member
          );
        const idxRemaining = this._state.status.remaining.findIndex(
          (x) => x === member
        );
        return idxParticipant !== -1 && idxRemaining !== -1;
      default:
        return false;
    }
  };

  readonly log = (s: string) => {
    console.log(`[${this.membership.me.nickname}] ${s}`);
  };

  readonly changeReadiness = (r: Member.Blockingness) => {
    switch (this._state.status.tag) {
      case "waiting":
        const mr = this._state.status.ready.find(
          (x) => x.member === this.membership.me.fingerprint
        );
        this.log(`Change readiness mr=${JSON.stringify(mr)}, r=${r}`);
        if (mr !== undefined && mr.readiness !== r)
          this.send(MemberEvent.blocking(r));
        break;
      case "proposed":
        if (r === "blocking" && this.canRefuse(this.membership.me.fingerprint))
          this.send(MemberEvent.blocking("blocking"));
        break;
      default:
        throw new Error("Trying to choose when harvesting???");
    }
  };

  readonly send = (event: MemberEvent) => {
    if (this._connectionController) this._connectionController.sendEvent(event);
    else
      console.log(`No connection controller to send ${JSON.stringify(event)}`);
  };

  //////////////////////////////////////////
  // Status Management

  private readonly resetStatus = (id: string, qs: string[]) => {
    this._choiceStatus = ChoiceStatus.noChoice;
    const ready: MemberReadiness[] = [];
    for (const mp of this._state.presences)
      if (mp.presence === Member.Presence.present)
        ready.push({
          member: mp.member,
          readiness: "answering",
        });
    this._state.status = AssemblyState.Status.waiting(
      id,
      qs.length > 0 ? qs[0] : null,
      ready
    );
  };

  private readonly reduceStatus = () => {
    const status = this._state.status;
    switch (status.tag) {
      case "waiting":
        if (
          status.ready.every((x) => x.readiness === "ready") &&
          status.ready.length >= this.minParticipants
        ) {
          const participants = status.ready.map((x) => x.member);
          const harvest: Harvest = {
            id: status.id,
            question: status.question,
            participants: participants,
          };
          this._state.status = AssemblyState.Status.proposed(
            harvest,
            structuredClone(participants)
          );
        }
        break;
      case "proposed":
        if (status.remaining.length < this.minParticipants) {
          const readiness: Map<Fingerprint, Member.Readiness> = new Map();

          for (const mp of this._state.presences)
            if (mp.presence.tag === "present")
              readiness.set(mp.member, "answering");
          for (const m of status.harvest.participants)
            readiness.set(m, "ready");

          const ready: MemberReadiness[] = [];
          readiness.forEach((v, k) =>
            ready.push({
              member: k,
              readiness: v,
            })
          );

          this._state.status = AssemblyState.Status.waiting(
            status.harvest.id,
            status.harvest.question,
            ready
          );
        }
        break;
      case "harvesting":
        break;
    }
  };

  private readonly memberPresence = (
    member: Fingerprint,
    presence: Member.Presence
  ) => {
    // Ensure we have the identity proof
    this._identityProofStore.fetch(member);

    // Update Presence
    const idxPresence = this._state.presences.findIndex(
      (x) => x.member === member
    );
    console.log(`${this.membership.me.nickname}: ${idxPresence}`);
    if (idxPresence === -1)
      this._state.presences.push({
        member: member,
        presence: presence,
      });
    else this._state.presences[idxPresence].presence = presence;

    // Updatting Status
    const status: AssemblyState.Status = this._state.status;
    switch (presence.tag) {
      case "present":
        switch (status.tag) {
          case "waiting":
            if (status.ready.findIndex((x) => x.member === member) === -1)
              status.ready.push({
                member: member,
                readiness: "answering",
              });
            break;
          default:
            break;
        }
        break;
      case "absent":
        // Updatting Readiness
        switch (status.tag) {
          case "waiting":
            const idxReady = status.ready.findIndex((x) => x.member === member);
            if (idxReady !== -1) {
              status.ready.splice(idxReady, 1);
              this.reduceStatus();
            }
            break;
          case "proposed":
            const idxParticipant = status.harvest.participants.findIndex(
              (x) => x === member
            );
            if (idxParticipant !== -1) {
              status.harvest.participants.splice(idxParticipant, 1);
              status.remaining = structuredClone(status.harvest.participants);
              this.reduceStatus();
            }
            break;
          default:
            break;
        }
        break;
    }
  };

  private readonly memberBlocking = (
    member: Fingerprint,
    blocking: Member.Blockingness
  ) => {
    const status = this._state.status;
    switch (status.tag) {
      case "waiting":
        const idxReady = status.ready.findIndex((x) => x.member === member);
        if (idxReady !== -1) {
          status.ready[idxReady].readiness = blocking;
          this.reduceStatus();
        }
        break;
      case "proposed":
        if (blocking === "blocking" && this.canRefuse(member)) {
          const readiness: Map<Fingerprint, Member.Readiness> = new Map();

          for (const mp of this._state.presences)
            if (mp.presence.tag === "present")
              readiness.set(mp.member, "answering");
          for (const m of status.harvest.participants)
            readiness.set(m, m === member ? "blocking" : "ready");

          const ready: MemberReadiness[] = [];
          readiness.forEach((v, k) =>
            ready.push({
              member: k,
              readiness: v,
            })
          );

          this._state.status = AssemblyState.Status.waiting(
            status.harvest.id,
            status.harvest.question,
            ready
          );
        }
        break;
      case "harvesting":
        break;
    }
  };

  readonly updateState = (ev: AssemblyEvent) => {
    switch (ev.tag) {
      case "state":
        this._state = ev.state;
        break;
      case "status":
        this._state.status = ev.status;
        break;
      case "public_event":
        const event: PublicEvent = ev.public_event;
        const status: AssemblyState.Status = this._state.status;
        switch (event.tag) {
          case "question_done":
            this.resetStatus(event.id, this._state.questions.slice(0, 1));
            this._state.questions = this._state.questions.slice(1, undefined);
            break;
          case "new_questions":
            this.resetStatus(event.id, event.questions.slice(0, 1));
            this._state.questions = event.questions.slice(1, undefined);
            break;
          case "member_presence":
            this.memberPresence(event.member, event.presence);
            break;
          case "member_blocking":
            this.memberBlocking(event.member, event.blocking);
            break;
          case "harvest_accepted":
            const status = this._state.status;
            switch (status.tag) {
              case "proposed":
                const idxRemaining = status.remaining.findIndex(
                  (x) => x === event.member
                );
                if (idxRemaining !== -1)
                  status.remaining.splice(idxRemaining, 1);
                break;
              default:
                break;
            }

            break;
        }
        break;
      case "error":
        if (ev.fatal)
          if (this._connectionController) this._connectionController.close();
        this.propagateFailure(ev.reason);
        break;
    }
    this.propagateState();
  };

  readonly updateConnection = (event: ConnectionEvent) => {
    switch (event.tag) {
      case "opened":
        this.propagateConnectionStatus("poignée de main en cours.");
        break;
      case "established":
        this.propagateConnectionStatus("réussie");
        break;
      case "closed":
        this.propagateConnectionStatus("fermée");
        break;
      case "error":
        this.propagateFailure(event.reason);
    }
  };
}
