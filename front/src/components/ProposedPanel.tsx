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
              J'accepte cette récolte.
            </button>
            <button
              type="button"
              onClick={() => props.changeReadiness("blocking")}
            >
              Je refuse cette récolote!
            </button>
          </div>
          <MemberList
            title="Membres participant à la récolte"
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
      <h3>Acceptes tu cette récolte?</h3>
      <p>
        Le consentement c'est important! La récolte ne démarrera pas tant que tu
        ne l'auras pas accepté. Personne ne peux plus rejoindre la récolte, à
        moins que tu ne la refuse pour revenir en arrière!
      </p>
      {page}
      <MemberList
        title="Membre n'ayant pas encore accepté la récolte"
        members={props.remaining}
        name={props.name}
      />
    </div>
  );
}
