import {
  IdentityProofStore,
  IdentityProofStoreFactory,
} from "../services/IdentityProofStore";
import { PublicEvent } from "./PublicEvent";
import { CryptoMembership, Fingerprint, IdentityProof } from "./Crypto";
import { AssemblyState, Member, MemberReadiness } from "./AssemblyState";
import { ChoiceStatus } from "./ChoiceStatus";
import { AssemblyAPI } from "../services/AssemblyAPI";
import { ConnectionEvent } from "./ConnectionEvent";
import ConnectionController from "./ConnectionController";
import { AssemblyEvent } from "./AssemblyEvent";

declare function structuredClone(value: any): any;

export type Listerner = {
  state: (state: AssemblyState) => void;
  failure: (reason: string) => void;
  connection: (status: string) => void;
};

export default class Assembly {
  private _identityProofStore: IdentityProofStore;
  private _identityProofs: Map<Fingerprint, IdentityProof> = new Map();
  private _assemblyAPI: AssemblyAPI;
  private _cryptoMembership: CryptoMembership;
  private _choiceStatus: ChoiceStatus = ChoiceStatus.noChoice;
  private _listeners: Listerner[] = [];
  private _running: boolean = false;
  private _connectionController: ConnectionController | null = null;

  private _state: AssemblyState = {
    questions: [],
    presences: [],
    status: AssemblyState.Status.waiting(null, []),
  };

  constructor(
    identityProofStoreFactory: IdentityProofStoreFactory,
    assemblyAPI: AssemblyAPI,
    cryptoMembership: CryptoMembership
  ) {
    this._identityProofStore = identityProofStoreFactory.identityProofStore(
      cryptoMembership.assembly
    );
    this._assemblyAPI = assemblyAPI;
    this._cryptoMembership = cryptoMembership;
    this.updateState = this.updateState.bind(this);
    this.updateConnection = this.updateConnection.bind(this);
    this.myAnswer = this.myAnswer.bind(this);
    this.myQuestion = this.myQuestion.bind(this);
    this.resetStatus = this.resetStatus.bind(this);
    this.cryptoMembership = this.cryptoMembership.bind(this);
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.running = this.running.bind(this);
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.clearListeners = this.clearListeners.bind(this);
    this.propagateState = this.propagateState.bind(this);
    this.propagateFailure = this.propagateFailure.bind(this);
    this.propagateConnectionStatus = this.propagateConnectionStatus.bind(this);
  }

  addListener(f: Listerner) {
    for (const g of this._listeners) if (f === g) return;
    this._listeners.push(f);
    f.state(this._state);
  }

  removeListener(f: Listerner) {
    let l = [];
    for (const g of this._listeners) if (f !== g) l.push(g);
    this._listeners = l;
  }

  clearListeners() {
    this._listeners = [];
  }

  private propagateState() {
    const clone = structuredClone(this._state);
    for (const l of this._listeners) {
      try {
        l.state(clone);
      } catch (e) {
        console.log(
          `Propagate state error ${e} on state ${JSON.stringify(clone)}`
        );
      }
    }
  }

  private propagateFailure(reason: string) {
    for (const l of this._listeners)
      try {
        l.failure(reason);
      } catch (e) {
        console.log(`Propagate error error ${e} on reason ${reason}`);
      }
  }

  private propagateConnectionStatus(status: string) {
    for (const l of this._listeners)
      try {
        l.connection(status);
      } catch (e) {
        console.log(
          `Propagate connection status error ${e} on status ${status}`
        );
      }
  }

  async start() {
    if (!this._running) {
      this._running = true;
      this._connectionController = await this._assemblyAPI.connect(
        this._cryptoMembership,
        this.updateState,
        this.updateConnection
      );
    }
  }

  running() {
    return this._running;
  }

  stop() {
    if (this._running) {
      this._running = false;
      if (this._connectionController) this._connectionController.close();
    }
  }

  cryptoMembership(): CryptoMembership {
    return this._cryptoMembership;
  }

  myQuestion(question: string | null) {
    this._choiceStatus = ChoiceStatus.question(question);
  }

  myAnswer(answer: boolean) {
    this._choiceStatus = ChoiceStatus.answer(answer);
  }

  private resetStatus(qs: string[]) {
    this._choiceStatus = ChoiceStatus.noChoice;
    const ready: MemberReadiness[] = [];
    for (const mp of this._state.presences)
      if (mp.presence === Member.Presence.present)
        ready.push({
          member: mp.member,
          readiness: "busy",
        });
    this._state.status = AssemblyState.Status.waiting(
      qs.length > 0 ? qs[0] : null,
      ready
    );
  }

  updateState(ev: AssemblyEvent) {
    switch (ev.tag) {
      case "state":
        this._state = ev.state;
        break;
      case "public_event":
        const event: PublicEvent = ev.public_event;
        const status: AssemblyState.Status = this._state.status;
        switch (event.tag) {
          case "question_done":
            this.resetStatus(this._state.questions.slice(0, 1));
            this._state.questions = this._state.questions.slice(1, undefined);
            break;
          case "new_questions":
            this._state.questions = event.questions.slice(1, undefined);
            this.resetStatus(event.questions.slice(0, 1));
            break;
          case "member_presence":
            for (let i in this._state.presences)
              if (this._state.presences[i].member === event.member) {
                this._state.presences[i].presence = event.presence;
              }
            switch (event.presence.tag) {
              case "present":
                let done = false;
                for (const mp of this._state.presences)
                  if (mp.member === event.member) {
                    done = true;
                    mp.presence = event.presence;
                  }
                if (!done) this._state.presences.push(event);
                switch (status.tag) {
                  case "waiting":
                    var present = false;
                    for (let i in status.ready)
                      if (status.ready[i].member === event.member)
                        present = true;
                    if (present === false)
                      status.ready.push({
                        member: event.member,
                        readiness: "busy",
                      });
                    break;
                  case "harvesting":
                    break;
                }
                break;
              case "absent":
                switch (status.tag) {
                  case "waiting":
                    let ready: MemberReadiness[] = [];
                    for (let mr of status.ready)
                      if (mr.member !== event.member) ready.push(mr);
                    status.ready = ready;
                    break;
                  case "harvesting":
                    break;
                }
                break;
            }
            break;
          case "member_ready":
            switch (status.tag) {
              case "waiting":
                for (let i in status.ready)
                  if (status.ready[i].member === event.member)
                    status.ready[i].readiness = "ready";
                break;
              case "harvesting":
                break;
            }
            break;
          case "status_update":
            this._state.status = event.status;
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
  }

  updateConnection(event: ConnectionEvent) {
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
  }
}
