import { IdentityProofStore } from "../services/IdentityProofStore";
import { AssemblyEvent, Event } from "./Events";
import { Fingerprint, IdentityProof } from "./Crypto";
import { Member, PublicState } from "./AssemblyState";

type Status = Waiting | Harvesting;

class Waiting {
  readonly tag: "waiting" = "waiting";
  ready: Map<Fingerprint, Member.Readiness>;

  constructor(ready: Map<Fingerprint, Member.Readiness>) {
    this.ready = ready;
  }
}

class Harvesting {
  readonly tag: "harvesting" = "harvesting";
  type: PublicState.Status.HarvestType;
  members: Set<Fingerprint>;

  constructor(type: PublicState.Status.HarvestType, members: Set<Fingerprint>) {
    this.type = type;
    this.members = members;
  }
}

export class Assembly {
  identityProofStore: IdentityProofStore;

  questions: string[] = [];
  members: Map<Fingerprint, Member.Presence> = new Map();
  status: Status = new Waiting(new Map());
  identityProofs: Map<Fingerprint, IdentityProof> = new Map();

  constructor(identityProofStore: IdentityProofStore) {
    this.identityProofStore = identityProofStore;
    this.updateStatus = this.updateStatus.bind(this);
    this.update = this.update.bind(this);
  }

  updateStatus(status: PublicState.Status) {
    switch (status.tag) {
      case "waiting":
        const m = new Map<Fingerprint, Member.Readiness>();
        for (const member of status.ready) {
          m.set(member.member, member.readiness);
        }
        this.status = new Waiting(m);
        break;
      case "harvesting":
        this.status = new Harvesting(status.type, new Set(status.members));
        break;
    }
  }

  update(ev: AssemblyEvent) {
    switch (ev.tag) {
      case "public_state":
        const state: PublicState = ev.public_state;
        this.questions = state.questions;
        this.members.clear();
        for (const member of state.presences) {
          this.members.set(member.member, member.presence);
        }
        this.updateStatus(state.status);
        break;
      case "public_event":
        const event: Event = ev.public_event;
        switch (event.tag) {
          case "question_done":
            this.questions = this.questions.slice(1, undefined);
            break;
          case "new_questions":
            this.questions = event.questions;
            break;
          case "member_update":
            this.members.set(event.member, event.presence);
            if (this.status.tag === "waiting") {
              this.status.ready.set(event.member, event.ready);
            }
            break;
          case "status_update":
            this.updateStatus(event.status);
            break;
        }
        break;
    }
  }
}
