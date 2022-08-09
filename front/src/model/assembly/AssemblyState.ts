import { Mutex } from "async-mutex";
import { Listener } from "../../lib/Listener";
import { IdentityProofStore } from "../../services/IdentityProofStore";
import { Ballot } from "../Ballot";
import { Fingerprint, Me } from "../Crypto";
import { AssemblyEvent } from "../events/AssemblyEvent";
import { HarvestingEvent } from "../events/HarvestingEvent";
import { MemberEvent } from "../events/MemberEvent";
import { ProtocolEvent } from "../events/ProtocolEvent";
import { PublicEvent } from "../events/PublicEvent";
import { HarvestResult } from "../HarvestResult";
import { HarvestState } from "../HarvestState";
import { Member, MemberAbsent, MemberReadiness } from "../Member";
import { Parameters } from "../Parameters";
import { Question } from "../Question";
import { Harvest } from "./Harvest";
import { Phase } from "./Phase";
import { State } from "./State";
import { Status } from "./Status";

export declare function structuredClone(value: any): any;

export class AssemblyState {
  readonly identityProofStore: IdentityProofStore;
  readonly me: Me;

  private mutex = new Mutex();
  private _harvestState: HarvestState;
  private _questions: Question[] = [];
  private _present: Set<Fingerprint> = new Set();
  private _absent: Map<Fingerprint, Date> = new Map();
  private _status: Status = Status.waiting("", null, []);
  private send: (event: MemberEvent) => void;
  private fail: (error: any) => never;

  constructor(
    identityProofStore: IdentityProofStore,
    me: Me,
    send: (event: MemberEvent) => void,
    fail: (error: any) => never
  ) {
    this.me = me;
    this.identityProofStore = identityProofStore;
    this.send = send;
    this.fail = fail;
    this._harvestState = new HarvestState(
      this.me,
      this.identityProofStore,
      "",
      null
    );
  }

  private readonly log = (s: string) => {
    console.log(`[${this.me.nickname}] ${s}`);
  };

  ////////////////////////////////////////
  // Getters

  readonly state = (): State => ({
    questions: structuredClone(this._questions),
    present: Array.from(this._present),
    absent: Array.from(this._absent.entries()).map(
      (x): MemberAbsent => ({
        member: x[0],
        since: x[1].getTime(),
      })
    ),
    status: structuredClone(this._status),
  });

  readonly listerner: Listener<State> = new Listener(this.state);
  readonly harvestResultListener = (): Listener<HarvestResult | null> =>
    this._harvestState.resultListerner;

  private readonly resetStatus = (id: string, qs: Question[]) => {
    const question = qs.length > 0 ? qs[0] : null;
    this._harvestState.reset(id, question);
    this._status = Status.waiting(
      id,
      question,
      Array.from(this._present).map(
        (x): MemberReadiness => ({
          member: x,
          readiness: "answering",
        })
      )
    );
  };

  private readonly forcedWaiting = (member: Fingerprint | null) => {
    if (this._status.tag === "harvesting") {
      const ready: MemberReadiness[] = [];
      for (const m of Array.from(this._present))
        ready.push({
          member: m,
          readiness:
            m === member
              ? "blocking"
              : this._status.harvest.participants.findIndex((x) => x === m) !==
                -1
              ? "ready"
              : "answering",
        });

      this._status = Status.waiting(
        this._status.harvest.id,
        this._status.harvest.question,
        ready
      );
      this._harvestState.resetHarvest();
    }
  };

  private readonly reduceStatus = () => {
    switch (this._status.tag) {
      case "waiting":
        if (
          this._status.ready.every((x) => x.readiness === "ready") &&
          this._status.ready.length >= Parameters.minParticipants
        ) {
          const participants = this._status.ready.map((x) => x.member);
          const harvest: Harvest = {
            id: this._status.id,
            question: this._status.question,
            participants: participants,
          };
          harvest.participants.sort();
          this._harvestState.setHarvest(harvest);
          this._status = Status.harvesting(
            harvest,
            Phase.proposed(structuredClone(participants))
          );
        }
        break;
      case "harvesting":
        if (this._status.phase.tag === "proposed")
          if (
            this._status.harvest.participants.length <
            Parameters.minParticipants
          )
            this.forcedWaiting(null);
          else if (this._status.phase.remaining.length === 0) {
            this._status = Status.harvesting(
              this._status.harvest,
              Phase.started
            );
            this._harvestState.setHarvest(this._status.harvest);
          }
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
        if (!this._present.has(member)) {
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
        }
        break;
      case "absent":
        if (!this._absent.has(member)) {
          this._present.delete(member);
          this._absent.set(member, new Date(presence.since));

          // Updatting Readiness
          switch (this._status.tag) {
            case "waiting":
              const idxReady = this._status.ready.findIndex(
                (x) => x.member === member
              );
              if (idxReady !== -1) this._status.ready.splice(idxReady, 1);
              break;
            case "harvesting":
              if (
                this._status.harvest.participants.findIndex(
                  (x: Fingerprint) => x === member
                ) !== -1
              )
                this.forcedWaiting(null);
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
        if (idxReady !== -1) this._status.ready[idxReady].readiness = blocking;
        break;
      case "harvesting":
        if (blocking === "blocking" && this.canRefuse(member))
          this.forcedWaiting(member);
    }
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

  private readonly memberAccept = (member: Fingerprint) => {
    if (
      this._status.tag === "harvesting" &&
      this._status.phase.tag === "proposed"
    ) {
      const idxRemaining = this._status.phase.remaining.findIndex(
        (x) => x === member
      );
      if (idxRemaining !== -1)
        this._status.phase.remaining.splice(idxRemaining, 1);
    }
  };

  private readonly failOnExceptionP = async <A>(
    f: () => Promise<A>
  ): Promise<A> => {
    try {
      return f();
    } catch (e) {
      this.forcedWaiting(null);
      this.fail(e);
    }
  };

  private readonly failOnException = <A>(f: () => A): A => {
    try {
      return f();
    } catch (e) {
      this.forcedWaiting(null);
      this.fail(e);
    }
  };

  //////////////////////////////////////////
  // Status Management

  readonly update = (ev: AssemblyEvent) =>
    this.mutex.runExclusive(() =>
      this.failOnExceptionP(async () => {
        switch (ev.tag) {
          case "status":
            this._status = ev.status;
            if (ev.status.tag === "waiting")
              this._harvestState.reset(ev.status.id, ev.status.question);
            break;
          case "public":
            const publicEvent: PublicEvent = ev.public;
            switch (publicEvent.tag) {
              case "question_done":
                this.resetStatus(publicEvent.id, this._questions.slice(0, 1));
                this._questions = this._questions.slice(1, undefined);
                break;
              case "new_questions":
                if (this._harvestState.result)
                  HarvestResult.checkSameQuestions(
                    this._harvestState.result,
                    publicEvent.questions
                  );
                this.resetStatus(
                  publicEvent.id,
                  publicEvent.questions.slice(0, 1)
                );
                this._questions = publicEvent.questions.slice(1, undefined);
                break;
              case "member_presence":
                this.memberPresence(publicEvent.member, publicEvent.presence);
                this.reduceStatus();
                break;
              case "member_blocking":
                this.memberBlocking(publicEvent.member, publicEvent.blocking);
                this.reduceStatus();
                break;
            }
            break;
          case "harvesting":
            const harvestingEvent: HarvestingEvent = ev.harvesting;
            switch (harvestingEvent.tag) {
              case "accepted":
                this.memberAccept(harvestingEvent.member);
                this.reduceStatus();
                break;
              case "invalid":
                this.forcedWaiting(null);
            }
            break;
          case "protocol":
            const protocolEvent: ProtocolEvent = ev.protocol;
            switch (protocolEvent.tag) {
              case "hash":
                const hashResponse = await this._harvestState.nextHash(
                  protocolEvent.previous,
                  protocolEvent.remaining
                );
                this.send(
                  MemberEvent.harvesting(
                    protocolEvent.remaining.length === 0
                      ? MemberEvent.HarvestingEvent.hashes(hashResponse)
                      : MemberEvent.HarvestingEvent.nextHash(hashResponse)
                  )
                );
                break;
              case "validate":
                const validateResponse = await this._harvestState.validate(
                  protocolEvent.hashes
                );
                this.send(
                  MemberEvent.harvesting(
                    MemberEvent.HarvestingEvent.valid(validateResponse)
                  )
                );
                break;
              case "validity":
                await this._harvestState.validity(protocolEvent.signatures);
                break;
              case "ballot":
                if (protocolEvent.remaining.length === 0) {
                  const ballots = await this._harvestState.finalBallot(
                    protocolEvent.previous
                  );
                  this.send(
                    MemberEvent.harvesting(
                      MemberEvent.HarvestingEvent.ballots(ballots)
                    )
                  );
                } else {
                  const ballotResponse = await this._harvestState.nextBallot(
                    protocolEvent.previous,
                    protocolEvent.remaining
                  );
                  this.send(
                    MemberEvent.harvesting(
                      MemberEvent.HarvestingEvent.nextBallot(ballotResponse)
                    )
                  );
                }
                break;
              case "ballots":
                await this._harvestState.verifyBallots(protocolEvent.ballots);
                break;
            }
            break;
          case "error":
            this.fail(ev.error);
        }
        this.listerner.propagate(this.state());
      })
    );

  readonly resetState = (st: State): void => {
    this._questions = st.questions;
    this._present = new Set(st.present);
    this._absent = new Map();
    st.absent.forEach((x) => {
      this._absent.set(x.member, new Date(x.since));
    });
    this._status = st.status;
    if (st.status.tag === "waiting")
      this._harvestState.reset(st.status.id, st.status.question);
  };

  ///////////////////////////////////////
  // Question Management

  readonly myQuestion = (question: Question | null) =>
    this.failOnException(() => {
      switch (this._status.tag) {
        case "waiting":
          this._harvestState.setBallot(Ballot.question(question));
          this.send(MemberEvent.blocking("ready"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly myClosedAnswer = (answer: boolean) =>
    this.failOnException(() => {
      switch (this._status.tag) {
        case "waiting":
          this._harvestState.setBallot(Ballot.closedAnswer(answer));
          this.send(MemberEvent.blocking("ready"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly myOpenAnswer = (answer: string) =>
    this.failOnException(() => {
      switch (this._status.tag) {
        case "waiting":
          this._harvestState.setBallot(Ballot.openAnswer(answer));
          this.send(MemberEvent.blocking("ready"));
          break;
        default:
          throw new Error("Trying to choose when harvesting???");
      }
    });

  readonly changeReadiness = (r: Member.Blockingness) =>
    this.failOnException(() => {
      switch (this._status.tag) {
        case "waiting":
          const mr = this._status.ready.find(
            (x) => x.member === this.me.fingerprint
          );
          if (mr !== undefined && mr.readiness !== r)
            this.send(MemberEvent.blocking(r));
          break;
        case "harvesting":
          if (r === "blocking" && this.canRefuse(this.me.fingerprint))
            this.send(MemberEvent.blocking("blocking"));
          else throw new Error("Trying to block when you can't");
      }
    });
}
