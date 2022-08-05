import { IdentityProofStore } from "../../services/IdentityProofStore";
import { PublicEvent } from "../events/PublicEvent";
import { Membership, Fingerprint, Name, Me } from "../Crypto";
import { State } from "./State";
import { Member, MemberAbsent, MemberReadiness } from "../Member";
import { AssemblyAPI } from "../../services/AssemblyAPI";
import { ConnectionEvent } from "../events/ConnectionEvent";
import ConnectionController from "../ConnectionController";
import { AssemblyEvent } from "../events/AssemblyEvent";
import { MemberEvent } from "../events/MemberEvent";
import { JSONNormalizedStringify } from "../../lib/JSONNormalizedStringify";
import { Harvest } from "./Harvest";
import { Mutex } from "async-mutex";
import { Status } from "./Status";
import { HarvestingEvent } from "../events/HarvestingEvent";
import { Phase } from "./Phase";
import { ProtocolEvent } from "../events/ProtocolEvent";
import { HarvestState } from "../HarvestState";
import { Ballot } from "../Ballot";

export declare function structuredClone(value: any): any;

export type Listerner = {
  readonly state: (state: State) => void;
  readonly failure: (error: string) => void;
  readonly connection: (status: string) => void;
};

export type RunningStatus = "stopped" | "starting" | "started" | "stopping";

export default class Assembly {
  private readonly minParticipants = 3;

  // Services
  readonly identityProofStore: IdentityProofStore;
  private readonly _assemblyAPI: AssemblyAPI;

  // Connection Details
  readonly membership: Membership;

  // Connection Handling
  private _listeners: Listerner[] = [];
  private _runningStatus: RunningStatus = "stopped";
  private _connectionController: ConnectionController | null = null;

  // Assembly Management
  private readonly mutex = new Mutex();
  private _harvestState: HarvestState;
  private _questions: string[] = [];
  private _present: Set<Fingerprint> = new Set();
  private _absent: Map<Fingerprint, Date> = new Map();
  private _status: Status = Status.waiting("", null, []);

  constructor(
    identityProofStore: IdentityProofStore,
    assemblyAPI: AssemblyAPI,
    membership: Membership
  ) {
    this.identityProofStore = identityProofStore;
    this._assemblyAPI = assemblyAPI;
    this.membership = membership;
    this._harvestState = new HarvestState(
      this.membership.me,
      this.identityProofStore,
      "",
      null
    );
  }

  private readonly state = async (): Promise<State> => ({
    questions: structuredClone(this._questions),
    present: Array.from(this._present.values()),
    absent: Array.from(this._absent.entries()).map(
      (x): MemberAbsent => ({
        member: x[0],
        since: x[1].getTime(),
      })
    ),
    status: structuredClone(this._status),
  });

  /////////////////////////////////
  // Listerners

  readonly addListener = async (f: Listerner) => {
    for (const g of this._listeners) if (f === g) return;
    this._listeners.push(f);
    f.state(await this.state());
  };

  readonly removeListener = (f: Listerner) => {
    let l = [];
    for (const g of this._listeners) if (f !== g) l.push(g);
    this._listeners = l;
  };

  readonly clearListeners = () => {
    this._listeners = [];
  };

  private readonly propagateState = async () => {
    const st = await this.state();
    for (const l of this._listeners) {
      try {
        l.state(st);
      } catch (e) {
        console.log(
          `Propagate state error ${e} on state ${JSONNormalizedStringify(st)}`
        );
      }
    }
  };

  private readonly propagateFailure = (error: string) => {
    for (const l of this._listeners)
      try {
        l.failure(error);
      } catch (e) {
        console.log(`Propagate error error ${e} on error ${error}`);
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

  readonly start = () =>
    this.mutex.runExclusive(async () => {
      if (this._runningStatus === "stopped") {
        this._runningStatus = "starting";
        console.log(
          `Starting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this._connectionController = await this._assemblyAPI.connect(
          this.membership,
          this.updateState,
          this.updateConnection
        );
        this._runningStatus = "started";
      }
    });

  readonly stop = () =>
    this.mutex.runExclusive(async () => {
      if (this._runningStatus === "started") {
        this._runningStatus = "stopping";
        console.log(
          `Stopping assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        if (this._connectionController) this._connectionController.close();
        this._runningStatus = "stopped";
      }
    });

  readonly restart = () =>
    this.mutex.runExclusive(async () => {
      if (this._runningStatus === "started") {
        this._runningStatus = "stopping";
        console.log(
          `Stopping assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        if (this._connectionController) this._connectionController.close();
        this._runningStatus = "stopped";
      }

      if (this._runningStatus === "stopped") {
        this._runningStatus = "starting";
        console.log(
          `Starting assembly ${this.membership.assembly.name}:${this.membership.assembly.id} for member ${this.membership.me.nickname}:${this.membership.me.fingerprint}`
        );
        this._connectionController = await this._assemblyAPI.connect(
          this.membership,
          this.updateState,
          this.updateConnection
        );
        this._runningStatus = "started";
      }
    });

  ////////////////////////////////////////
  // Getters

  readonly name = async (member: Fingerprint): Promise<Name> =>
    (await this.identityProofStore.fetch(member)).nickname.value;

  ///////////////////////////////////////
  // Question Management

  readonly myQuestion = (question: string | null) =>
    this.mutex.runExclusive(async () => {
      switch (this._status.tag) {
        case "waiting":
          try {
            this._harvestState.setBallot(Ballot.question(question));
          } catch (e) {
            this.propagateFailure(`${e}`);
          }
          this.send(MemberEvent.blocking("ready"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly myAnswer = (answer: boolean) =>
    this.mutex.runExclusive(async () => {
      switch (this._status.tag) {
        case "waiting":
          try {
            this._harvestState.setBallot(Ballot.answer(answer));
          } catch (e) {
            this.propagateFailure(`${e}`);
          }
          this.send(MemberEvent.blocking("ready"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly acceptHarvest = () => {
    this.send(MemberEvent.acceptHarvest);
  };

  private readonly canRefuse = (member: Fingerprint): boolean => {
    switch (this._status.tag) {
      case "harvesting":
        switch (this._status.phase.tag) {
          case "proposed":
            const idxParticipant = this._status.harvest.participants.findIndex(
              (x: Fingerprint) => x === member
            );
            const idxRemaining = this._status.phase.remaining.findIndex(
              (x) => x === member
            );
            return idxParticipant !== -1 && idxRemaining !== -1;
          default:
            return false;
        }
      default:
        return false;
    }
  };

  private readonly log = (s: string) => {
    console.log(`[${this.membership.me.nickname}] ${s}`);
  };

  readonly changeReadiness = (r: Member.Blockingness) =>
    this.mutex.runExclusive(async () => {
      switch (this._status.tag) {
        case "waiting":
          const mr = this._status.ready.find(
            (x) => x.member === this.membership.me.fingerprint
          );
          if (mr !== undefined && mr.readiness !== r)
            this.send(MemberEvent.blocking(r));
          break;
        case "harvesting":
          if (
            r === "blocking" &&
            this.canRefuse(this.membership.me.fingerprint)
          )
            this.send(MemberEvent.blocking("blocking"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly send = (event: MemberEvent) => {
    if (this._connectionController) this._connectionController.sendEvent(event);
    else
      console.log(`No connection controller to send ${JSON.stringify(event)}`);
  };

  //////////////////////////////////////////
  // Status Management

  private readonly resetStatus = (id: string, qs: string[]) => {
    const question = qs.length > 0 ? qs[0] : null;
    this._harvestState = new HarvestState(
      this.membership.me,
      this.identityProofStore,
      id,
      question
    );
    this._status = Status.waiting(
      id,
      question,
      Array.from(this._present.values()).map(
        (x): MemberReadiness => ({
          member: x,
          readiness: "answering",
        })
      )
    );
  };

  private readonly reduceStatus = () => {
    switch (this._status.tag) {
      case "waiting":
        if (
          this._status.ready.every((x) => x.readiness === "ready") &&
          this._status.ready.length >= this.minParticipants
        ) {
          const participants = this._status.ready.map((x) => x.member);
          const harvest: Harvest = {
            id: this._status.id,
            question: this._status.question,
            participants: participants,
          };
          this._harvestState.setHarvest(harvest);
          this._status = Status.harvesting(
            harvest,
            Phase.proposed(structuredClone(participants))
          );
        }
        break;
      case "harvesting":
        if (this._status.phase.tag === "proposed")
          if (this._status.harvest.participants.length < this.minParticipants) {
            const readiness: Map<Fingerprint, Member.Readiness> = new Map();

            this._present.forEach((x) => {
              readiness.set(x, "answering");
            });
            for (const m of this._status.harvest.participants)
              readiness.set(m, "ready");

            const ready: MemberReadiness[] = [];
            readiness.forEach((v, k) =>
              ready.push({
                member: k,
                readiness: v,
              })
            );

            this._status = Status.waiting(
              this._status.harvest.id,
              this._status.harvest.question,
              ready
            );
          } else if (this._status.phase.remaining.length === 0)
            this._status = Status.harvesting(
              this._status.harvest,
              Phase.started
            );
    }
  };

  private readonly memberPresence = (
    member: Fingerprint,
    presence: Member.Presence
  ) => {
    // Ensure we have the identity proof
    this.identityProofStore.fetch(member);

    // Updatting Status
    switch (presence.tag) {
      case "present":
        this._present.add(member);
        this._absent.delete(member);

        if (
          this._status.tag === "waiting" &&
          this._status.ready.findIndex((x) => x.member === member) === -1
        )
          this._status.ready.push({
            member: member,
            readiness: "answering",
          });
        break;
      case "absent":
        this._present.delete(member);
        this._absent.set(member, new Date(presence.since));

        // Updatting Readiness
        switch (this._status.tag) {
          case "waiting":
            const idxReady = this._status.ready.findIndex(
              (x) => x.member === member
            );
            if (idxReady !== -1) {
              this._status.ready.splice(idxReady, 1);
              this.reduceStatus();
            }
            break;
          case "harvesting":
            switch (this._status.phase.tag) {
              case "proposed":
                const idxParticipant =
                  this._status.harvest.participants.findIndex(
                    (x: Fingerprint) => x === member
                  );
                if (idxParticipant !== -1) {
                  this._status.harvest.participants.splice(idxParticipant, 1);
                  this._status.phase.remaining = structuredClone(
                    this._status.harvest.participants
                  );
                  this.reduceStatus();
                }
            }
        }
    }
  };

  private readonly memberBlocking = (
    member: Fingerprint,
    blocking: Member.Blockingness
  ) => {
    switch (this._status.tag) {
      case "waiting":
        const idxReady = this._status.ready.findIndex(
          (x) => x.member === member
        );
        if (idxReady !== -1) {
          this._status.ready[idxReady].readiness = blocking;
          this.reduceStatus();
        }
        break;
      case "harvesting":
        if (blocking === "blocking" && this.canRefuse(member)) {
          const readiness: Map<Fingerprint, Member.Readiness> = new Map();

          this._present.forEach((x) => {
            readiness.set(x, "answering");
          });
          for (const m of this._status.harvest.participants)
            readiness.set(m, m === member ? "blocking" : "ready");

          const ready: MemberReadiness[] = [];
          readiness.forEach((v, k) =>
            ready.push({
              member: k,
              readiness: v,
            })
          );

          this._status = Status.waiting(
            this._status.harvest.id,
            this._status.harvest.question,
            ready
          );
        }
    }
  };

  readonly updateState = (ev: AssemblyEvent) =>
    this.mutex.runExclusive(async () => {
      switch (ev.tag) {
        case "status":
          this._status = ev.status;
          if (ev.status.tag === "waiting")
            this._harvestState = new HarvestState(
              this.membership.me,
              this.identityProofStore,
              ev.status.id,
              ev.status.question
            );
          break;
        case "public":
          const publicEvent: PublicEvent = ev.public;
          switch (publicEvent.tag) {
            case "question_done":
              this.resetStatus(publicEvent.id, this._questions.slice(0, 1));
              this._questions = this._questions.slice(1, undefined);
              break;
            case "new_questions":
              this.resetStatus(
                publicEvent.id,
                publicEvent.questions.slice(0, 1)
              );
              this._questions = publicEvent.questions.slice(1, undefined);
              break;
            case "member_presence":
              this.memberPresence(publicEvent.member, publicEvent.presence);
              break;
            case "member_blocking":
              this.memberBlocking(publicEvent.member, publicEvent.blocking);
              break;
          }
          break;
        case "harvesting":
          const harvestingEvent: HarvestingEvent = ev.harvesting;
          switch (harvestingEvent.tag) {
            case "accepted":
              if (
                this._status.tag === "harvesting" &&
                this._status.phase.tag === "proposed"
              ) {
                const idxRemaining = this._status.phase.remaining.findIndex(
                  (x) => x === harvestingEvent.member
                );
                if (idxRemaining !== -1)
                  this._status.phase.remaining.splice(idxRemaining, 1);
                this.reduceStatus();
              }
          }
          break;
        case "protocol":
          const protocolEvent: ProtocolEvent = ev.protocol;
          switch (protocolEvent.tag) {
            case "hash":
          }
          break;
        case "error":
          if (ev.fatal)
            if (this._connectionController) this._connectionController.close();
          this.propagateFailure(ev.error);
      }
      this.propagateState();
    });

  readonly updateConnection = async (event: ConnectionEvent): Promise<void> => {
    switch (event.tag) {
      case "opened":
        this.propagateConnectionStatus("poignée de main en cours.");
        break;
      case "established":
        await this.mutex.runExclusive(() => {
          this._questions = event.state.questions;
          this._present = new Set(event.state.present);
          this._absent = new Map();
          event.state.absent.forEach((x) => {
            this._absent.set(x.member, new Date(x.since));
          });
          this._status = event.state.status;
          if (event.state.status.tag === "waiting")
            this._harvestState = new HarvestState(
              this.membership.me,
              this.identityProofStore,
              event.state.status.id,
              event.state.status.question
            );
        });
        this.propagateState();
        this.propagateConnectionStatus("réussie");
        break;
      case "closed":
        this.propagateConnectionStatus("fermée");
        break;
      case "error":
        this.propagateFailure(event.error);
    }
  };
}
