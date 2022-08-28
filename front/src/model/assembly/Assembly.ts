import { Mutex } from "async-mutex";
import { Listener } from "../../lib/Listener";
import { AssemblyAPI } from "../../services/AssemblyAPI";
import { IdentityProofStore } from "../../services/IdentityProofStore";
import { StorageAPI } from "../../services/StorageAPI";
import ConnectionController from "../ConnectionController";
import { Fingerprint, Membership, Name } from "../Crypto";
import { ConnectionEvent } from "../events/ConnectionEvent";
import { MemberEvent } from "../events/MemberEvent";
import { HarvestResult } from "../HarvestResult";
import { Member } from "../Member";
import { Parameters } from "../Parameters";
import { Question } from "../Question";
import { SeatState } from "../SteatState";
import { AssemblyState } from "./AssemblyState";
import { State } from "./State";

export declare function structuredClone(value: any): any;

export type RunningStatus = "started" | "stopped";
export type ConnectionStatus = "opened" | "established" | "closed";
type ReconnectionStatus =
  | "neverEstablished"
  | "firstReconnectAttempt"
  | "reconnectionLoop";

export default class Assembly {
  // Services
  private readonly storageAPI: StorageAPI;
  private readonly assemblyAPI: AssemblyAPI;
  readonly membership: Membership;

  // Connection Handling
  readonly seatListeners: Listener<SeatState>;

  // Assembly Management

  constructor(
    storageAPI: StorageAPI,
    identityProofStore: IdentityProofStore,
    assemblyAPI: AssemblyAPI,
    membership: Membership,
    getSeatState: () => SeatState
  ) {
    this.storageAPI = storageAPI;
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

  private reconnectionStatus: ReconnectionStatus = "neverEstablished";
  private reconnectionInProgress: boolean = false;

  private readonly scheduleReconnect = (): void => {
    if (!this.reconnectionInProgress) {
      switch (this.reconnectionStatus) {
        case "firstReconnectAttempt":
          this.reconnectionInProgress = true;
          this.reconnectionStatus = "reconnectionLoop";
          queueMicrotask(this.reconnect);
          break;
        case "reconnectionLoop":
          this.reconnectionInProgress = true;
          setTimeout(this.reconnect, Parameters.reconnectDelay);
          break;
        case "neverEstablished":
          this.log("Never established, giving up.");
      }
    } else this.log("Reconnection already in progress.");
  };

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
        return await this.connectionStatusListerner.waitFor(
          (cs: ConnectionStatus) => {
            switch (cs) {
              case "established":
                return true;
              case "closed":
                return false;
              case "opened":
                return undefined;
            }
          }
        );
      } catch (e) {
        this.log(
          `Connection failed to assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this.scheduleReconnect();
        throw e;
      }
    } else return false;
  };

  private unsafeDisconnect = async (): Promise<void> => {
    if (this._connectionStatus !== "closed") {
      if (this.connectionController) {
        this.log(
          `Disconnecting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this.connectionController.close(null);
        this.connectionController = null;
      }
      this._connectionStatus = "closed";
      this.connectionStatusListerner.propagate(this._connectionStatus);
    }
  };

  readonly reconnect = () =>
    this.runningMutex.runExclusive(async () => {
      this.reconnectionInProgress = false;
      if (this._runningStatus === "started") {
        this.unsafeDisconnect();
        await this.unsafeConnect();
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
        // Now that we know the connection is safe, we can store credentials
        if (this.reconnectionStatus === "neverEstablished") {
          this.reconnectionStatus = "firstReconnectAttempt";
          this.storageAPI.storeLastMembership(this.membership);
          this.storageAPI.storeNickname(this.membership.me.nickname);
        }

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
        this.scheduleReconnect();
        break;
      case "error":
        this.log(`Connection error ${event.error}.`);

        this._connectionStatus = "closed";
        this.connectionController = null;
        this.connectionStatusListerner.propagate(this._connectionStatus);

        this.seatListeners.propagate(
          SeatState.failure(event.error, this.membership.me.nickname, this)
        );
        this.scheduleReconnect();
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
      this.reconnectionInProgress = false;
      this._runningStatus = "started";
      this.unsafeDisconnect();
      await this.unsafeConnect();
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

  readonly myQuestion = (question: Question | null) =>
    this.assemblyState.myQuestion(question);
  readonly myClosedAnswer = (answer: boolean) =>
    this.assemblyState.myClosedAnswer(answer);
  readonly myOpenAnswer = (answer: string) =>
    this.assemblyState.myOpenAnswer(answer);
  readonly changeReadiness = (r: Member.Blockingness) =>
    this.assemblyState.changeReadiness(r);
  readonly acceptHarvest = () => this.send(MemberEvent.accept);
}
