import { Mutex } from "async-mutex";
import { Listener } from "../../lib/Listener";
import { AssemblyAPI } from "../../services/AssemblyAPI";
import { IdentityProofStore } from "../../services/IdentityProofStore";
import ConnectionController from "../ConnectionController";
import { Fingerprint, Membership, Name } from "../Crypto";
import { ConnectionEvent } from "../events/ConnectionEvent";
import { MemberEvent } from "../events/MemberEvent";
import { HarvestResult } from "../HarvestResult";
import { Member } from "../Member";
import { Parameters } from "../Parameters";
import { SeatState } from "../SteatState";
import { AssemblyState } from "./AssemblyState";
import { State } from "./State";

export declare function structuredClone(value: any): any;

export type RunningStatus = "started" | "stopped";
export type ConnectionStatus = "opened" | "established" | "closed";

export default class Assembly {
  // Services
  private readonly assemblyAPI: AssemblyAPI;
  readonly membership: Membership;

  // Connection Handling
  readonly seatListeners: Listener<SeatState>;

  // Assembly Management

  constructor(
    identityProofStore: IdentityProofStore,
    assemblyAPI: AssemblyAPI,
    membership: Membership,
    getSeatState: () => SeatState
  ) {
    this.assemblyAPI = assemblyAPI;
    this.identityProofStore = identityProofStore;
    this.membership = membership;
    this.seatListeners = new Listener(getSeatState);
    this.assemblyState = new AssemblyState(
      identityProofStore,
      membership.me,
      this.send,
      this.fail
    );
  }

  private readonly log = (s: string) => {
    console.log(`[${this.membership.me.nickname}] ${s}`);
  };

  readonly identityProofStore: IdentityProofStore;

  readonly name = async (member: Fingerprint): Promise<Name> =>
    (await this.identityProofStore.fetch(member)).nickname.value;

  /////////////////////////////////
  // Connection State Management

  private connectionController: ConnectionController | null = null;

  readonly send = (event: MemberEvent) => {
    if (this.connectionController) this.connectionController.sendEvent(event);
    else this.log(`No connection controller to send ${JSON.stringify(event)}`);
  };

  private _connectionStatus: ConnectionStatus = "closed";

  readonly connectionStatusListerner: Listener<ConnectionStatus> = new Listener(
    () => this._connectionStatus
  );

  private readonly unsafeConnect = async (): Promise<boolean> => {
    if (this._connectionStatus === "closed") {
      this.log(
        `Connecting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
      );
      try {
        this.connectionController = await this.assemblyAPI.connect(
          this.membership,
          this.assemblyState.update,
          this.updateConnection
        );
      } catch (e) {
        this.log(
          `Connection failed to assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        throw e;
      }
      this._connectionStatus = "opened";
      this.connectionStatusListerner.propagate(this._connectionStatus);
      return true;
    } else return false;
  };

  private unsafeDisconnect = async (): Promise<void> => {
    if (this._connectionStatus !== "closed") {
      if (this.connectionController) {
        this.log(
          `Disconnecting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this.connectionController.close();
        this.connectionController = null;
      }
      this._connectionStatus = "closed";
      this.connectionStatusListerner.propagate(this._connectionStatus);
    }
  };

  readonly reconnect = (force: boolean) =>
    this.runningMutex.runExclusive(async () => {
      if (this._runningStatus === "started") {
        if (force) this.unsafeDisconnect();
        try {
          await this.unsafeConnect();
        } catch (e) {
          setTimeout(() => this.reconnect(false), Parameters.reconnectDelay);
        }
      }
    });

  readonly updateConnection = async (event: ConnectionEvent): Promise<void> => {
    switch (event.tag) {
      case "opened":
        this.log(`Connection opened.`);
        this._connectionStatus = "opened";
        this.connectionController = event.connectionController;
        this.connectionStatusListerner.propagate(this._connectionStatus);
        break;
      case "established":
        this.log(
          `Connection established with state ${JSON.stringify(event.state)}`
        );

        this.assemblyState.resetState(event.state);

        this._connectionStatus = "established";
        this.connectionStatusListerner.propagate(this._connectionStatus);

        this.seatListeners.propagate(SeatState.assembly(this));
        this.assemblyState.listerner.propagate(this.assemblyState.state());
        break;
      case "closed":
        this.log(`Connection closed.`);
        this._connectionStatus = "closed";
        this.connectionController = null;
        this.connectionStatusListerner.propagate(this._connectionStatus);
        this.reconnect(false);
        break;
      case "error":
        this.log(`Connection error ${event.error}.`);
        this.reconnect(true);
    }
  };

  /////////////////////////////////
  // Running State Management

  private _runningStatus: RunningStatus = "stopped";

  readonly runningStatus = (): RunningStatus => this._runningStatus;

  private readonly runningMutex = new Mutex();

  readonly start = (): Promise<void> =>
    this.runningMutex.runExclusive(async () => {
      if (this._runningStatus === "stopped") {
        this.log(
          `Starting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this.unsafeConnect();
        this._runningStatus = "started";
      }
    });

  readonly stop = (): Promise<void> =>
    this.runningMutex.runExclusive(() => {
      this.log(
        `Stopping assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
      );
      this.unsafeDisconnect();
      this._runningStatus = "stopped";
    });

  readonly restart = (): Promise<void> =>
    this.runningMutex.runExclusive(async () => {
      this.unsafeDisconnect();
      await this.unsafeConnect;
      this._runningStatus = "started";
    });

  private readonly fail = (error: any): never => {
    this.stop();
    this.seatListeners.propagate(
      SeatState.failure(error, this.membership.me.nickname, this)
    );
    throw error;
  };

  /////////////////////////////////
  // State Management

  private assemblyState: AssemblyState;

  readonly stateListener = (): Listener<State> => this.assemblyState.listerner;

  readonly harvestResultListener = (): Listener<HarvestResult | null> =>
    this.assemblyState.harvestResultListener();

  /////////////////////////////////////////////////
  // Question Management

  readonly myQuestion = (question: string | null) =>
    this.assemblyState.myQuestion(question);
  readonly myAnswer = (answer: boolean) => this.assemblyState.myAnswer(answer);
  readonly changeReadiness = (r: Member.Blockingness) =>
    this.assemblyState.changeReadiness(r);
  readonly acceptHarvest = () => this.send(MemberEvent.accept);
}
