import { useState } from "react";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { Member } from "../model/Member";
import { Harvest } from "../model/assembly/Harvest";

type Props = {
  harvest: Harvest;
  remaining: Fingerprint[];
  acceptHarvest(): void;
  changeReadiness(r: Member.Blockingness): void;
  name(member: Fingerprint): Promise<Name>;
};

type Phase = "proposed" | "accepted";

export default function ProposedPanel(props: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>("proposed");

  function goToAccepted() {
    props.acceptHarvest();
    setPhase("accepted");
  }

  let page: JSX.Element;

  switch (phase) {
    case "proposed":
      page = (
        <div>
          <div>
            <button type="button" onClick={goToAccepted}>
              Accepter la récolte.
            </button>
            <button
              type="button"
              onClick={() => props.changeReadiness("blocking")}
            >
              Blocker la récolte.
            </button>
          </div>
          <MemberList
            title="Participant.e.s à la récolte"
            members={props.harvest.participants}
            name={props.name}
          />
        </div>
      );
      break;
    case "accepted":
      page = <p>Vous avez accepté de démarrer le vote</p>;
      break;
  }

  return (
    <div>
      <h4>Tout le monde est prêt.e pour la récolte.</h4>
      {page}
      <MemberList
        title="N'ont pas encore accepté la récolte"
        members={props.remaining}
        name={props.name}
      />
    </div>
  );
}
