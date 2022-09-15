import { MGetSet, MVar, ObservableMVar } from "../../lib/MVar";
import { Observable } from "../../lib/Observable";
import { GetSet, ObservableVar } from "../../lib/Var";
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
import { UXConfig } from "../UXConfig";
import { AssemblyState } from "./AssemblyState";
import { State } from "./State";

export declare function structuredClone(value: any): any;

export type RunningStatus = "started" | "stopped";
export type ConnectionStatus =
  | "connecting"
  | "opened"
  | "established"
  | "closed";
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
  readonly seatListeners: ObservableVar<SeatState>;

  // Config
  readonly uxConfig: UXConfig;

  constructor(
    storageAPI: StorageAPI,
    identityProofStore: IdentityProofStore,
    assemblyAPI: AssemblyAPI,
    membership: Membership,
    seatState: GetSet<SeatState>
  ) {
    this.storageAPI = storageAPI;
    this.uxConfig = UXConfig.fromStorageAPI(storageAPI);
    this.assemblyAPI = assemblyAPI;
    this.identityProofStore = identityProofStore;
    this.membership = membership;
    this.seatListeners = ObservableVar.fromGetSet(seatState);
    this.assemblyState = new AssemblyState(
      identityProofStore,
      membership.me,
      this.send,
      this.fail,
      this.uxConfig.autoAccept.get,
      this.uxConfig.disableBlocking.get
    );

    // If we disable blocking while blocking, we are ready!
    this.uxConfig.disableBlocking.addListener((v) => {
      if (v && this.assemblyState.amIBlocking()) this.changeReadiness("ready");
    });

    // If we activate automatic accept while not accepted, we accept!
    this.uxConfig.autoAccept.addListener((v) => {
      if (v && this.assemblyState.canRefuse(this.membership.me.fingerprint))
        this.acceptHarvest();
    });
  }

  private readonly log = (s: string) => {
    console.log(`[${this.membership.me.nickname}] ${s}`);
  };

  readonly identityProofStore: IdentityProofStore;

  readonly name = async (member: Fingerprint): Promise<Name> =>
    (await this.identityProofStore.fetch(member)).nickname.value;

  /////////////////////////////////
  // Connection State

  private runningStatus: MVar<RunningStatus> = MVar.fromMGetSet(
    MGetSet.variable<RunningStatus>("stopped")
  );

  private connectionStatus: ObservableMVar<ConnectionStatus> =
    ObservableMVar.fromMGetSet(MGetSet.variable<ConnectionStatus>("closed"));

  private connectionController: ConnectionController | null = null;

  private reconnectionStatus: ReconnectionStatus = "neverEstablished";

  // Connection State Management

  private unsafeDisconnect = (): void => {
    const oldConnectionController = this.connectionController;
    if (oldConnectionController) {
      this.log(
        `Disconnecting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
      );
      this.connectionController = null;
      oldConnectionController.close(null);
    }
  };

  readonly updateConnection = async (event: ConnectionEvent): Promise<void> => {
    switch (event.tag) {
      case "opened":
        this.log(`Connection opened.`);
        this.connectionController = event.connectionController;
        this.connectionStatus.set("opened");
        break;
      case "established":
        // Now that we know the connection is safe, we can store credentials
        if (this.reconnectionStatus === "neverEstablished") {
          this.storageAPI.storeLastMembership(this.membership);
          this.storageAPI.storeNickname(this.membership.me.nickname);
        }
        this.reconnectionStatus = "firstReconnectAttempt";
        this.log(
          `Connectionsrc/components/App.tsx:109:22 established with state ${JSON.stringify(
            event.state
          )}`
        );
        this.assemblyState.resetState(event.state);
        this.connectionStatus.set("established");
        this.seatListeners.set(SeatState.assembly(this));
        break;
      case "closed":
        this.log(`Connection closed.`);
        this.connectionController = null;
        this.connectionStatus.set("closed");
        this.scheduleFixConnectionState();
        break;
      case "error":
        this.log(`Connection error ${event.error}.`);
        this.connectionController = null;
        this.connectionStatus.set("closed");
        this.seatListeners.set(
          SeatState.failure(event.error, this.membership.me.nickname, this)
        );
        this.scheduleFixConnectionState();
    }
  };

  private readonly unsafeConnect = async (): Promise<ConnectionStatus> => {
    this.log(
      `Connecting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
    );
    try {
      this.connectionController = await this.assemblyAPI.connect(
        this.membership,
        this.safeConnectionOrigin(this.assemblyState.update),
        this.safeConnectionOrigin(this.updateConnection)
      );
      return Promise.resolve("connecting");
    } catch (e) {
      this.log(
        `Connection failed to assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
      );
      this.scheduleFixConnectionState();
      throw e;
    }
  };

  private readonly fixConnectionState = async (): Promise<void> =>
    this.runningStatus.with(async (runningStatus: RunningStatus) =>
      this.connectionStatus.modify(
        async (connectionStatus: ConnectionStatus) => {
          if (runningStatus === "started" && connectionStatus === "closed")
            return Promise.resolve(await this.unsafeConnect());
          else if (
            runningStatus === "stopped" &&
            connectionStatus !== "closed"
          ) {
            this.unsafeDisconnect();
            return Promise.resolve("closed");
          } else return Promise.resolve(connectionStatus);
        }
      )
    );

  private readonly scheduleFixConnectionState = (): void => {
    switch (this.reconnectionStatus) {
      case "firstReconnectAttempt":
        this.reconnectionStatus = "reconnectionLoop";
        queueMicrotask(this.fixConnectionState);
        break;
      case "reconnectionLoop":
        setTimeout(this.fixConnectionState, Parameters.reconnectDelay);
        break;
      case "neverEstablished":
        console.log("Giving up reconnecting.");
        break;
    }
  };

  /////////////////////////////////
  // Running State Management

  readonly reconnect = async (): Promise<void> => {
    await this.connectionStatus.setWith(async () => {
      this.unsafeDisconnect();
      return Promise.resolve("closed");
    });
    return this.fixConnectionState();
  };

  readonly restart = async (): Promise<void> => {
    this.log(
      `Restarting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
    );
    await this.runningStatus.setWith(async () => {
      await this.connectionStatus.setWith(async () => {
        this.unsafeDisconnect();
        return Promise.resolve("closed");
      });
      return Promise.resolve("started");
    });
    return this.fixConnectionState();
  };

  readonly start = async (): Promise<void> => {
    this.log(
      `Starting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
    );
    await this.runningStatus.set("started");
    return this.fixConnectionState();
  };

  readonly stop = async (): Promise<void> => {
    this.log(
      `Stopping assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
    );
    await this.runningStatus.set("stopped");
    return this.fixConnectionState();
  };

  private readonly fail = (error: any): never => {
    this.stop();
    this.seatListeners.set(
      SeatState.failure(error, this.membership.me.nickname, this)
    );
    throw error;
  };

  /////////////////////////////////
  // Connection Helpers

  readonly connectionStatusListener: Observable<ConnectionStatus> =
    this.connectionStatus;

  readonly send = (event: MemberEvent): void => {
    if (this.connectionController) this.connectionController.sendEvent(event);
    else this.log(`No connection controller to send ${JSON.stringify(event)}`);
  };

  private readonly safeConnectionOrigin =
    <A>(f: (a: A) => void) =>
    (connectionId: string, a: A) => {
      if (
        this.connectionController !== null &&
        this.connectionController.id === connectionId
      )
        return f(a);
    };

  /////////////////////////////////
  // State Management

  private assemblyState: AssemblyState;

  readonly stateObservable = (): Observable<State> =>
    this.assemblyState.listenState;

  readonly harvestResultListener = (): Observable<HarvestResult | null> =>
    this.assemblyState.listenHarvestResult;

  /////////////////////////////////////////////////
  // Question Management

  readonly acceptHarvest = () => this.send(MemberEvent.accept);
  readonly refuseHarvest = () => this.send(MemberEvent.refuse);

  readonly myQuestion = (question: Question | null) =>
    this.assemblyState.myQuestion(question);
  readonly myClosedAnswer = (answer: boolean) =>
    this.assemblyState.myClosedAnswer(answer);
  readonly myOpenAnswer = (answer: string) =>
    this.assemblyState.myOpenAnswer(answer);
  readonly changeReadiness = (r: Member.Blockingness) =>
    this.assemblyState.changeReadiness(r);
}
