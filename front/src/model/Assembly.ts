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

export declare function structuredClone(value: any): any;

export type Listerner = {
  state: (state: AssemblyState) => void;
  failure: (reason: string) => void;
  connection: (status: string) => void;
};

export type RunningStatus = "stopped" | "starting" | "started" | "stopping";

export default class Assembly {
  // Services
  private _identityProofStore: IdentityProofStore;
  private _assemblyAPI: AssemblyAPI;

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
    id: "",
    presences: [],
    status: AssemblyState.Status.waiting(null, []),
  };

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

  readonly start = async () => {
    if (this._runningStatus === "stopped") {
      this._runningStatus = "starting";
      this._connectionController = await this._assemblyAPI.connect(
        this.membership,
        this.updateState,
        this.updateConnection
      );
      this._runningStatus = "started";
    }
  };

  readonly stop = () => {
    if (this._runningStatus === "started") {
      this._runningStatus = "stopping";
      if (this._connectionController) this._connectionController.close();
      this._runningStatus = "stopped";
    }
  };

  ////////////////////////////////////////
  // Getters

  readonly name = async (member: Fingerprint): Promise<Name> =>
    (await this._identityProofStore.fetch(member)).nickname.value;

  ///////////////////////////////////////
  // Question Management

  readonly myQuestion = (question: string | null) => {
    this._choiceStatus = ChoiceStatus.question(this._state.id, question);
    this.send(MemberEvent.ready);
  };

  readonly myAnswer = (answer: boolean) => {
    this._choiceStatus = ChoiceStatus.answer(this._state.id, answer);
    this.send(MemberEvent.ready);
  };

  readonly send = (event: MemberEvent) => {
    if (this._connectionController) this._connectionController.sendEvent(event);
    else
      console.log(`No connection controller to send ${JSON.stringify(event)}`);
  };

  //////////////////////////////////////////
  // Status Management

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

  readonly updateState = (ev: AssemblyEvent) => {
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
            // Ensure we have the identity proof
            this._identityProofStore.fetch(event.member);
            // But do not block!
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
