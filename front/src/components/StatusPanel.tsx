import { Fingerprint, Name } from "../model/Crypto";
import WaitingPanel from "./WaitingPanel";
import ProposedPanel from "./ProposedPanel";
import { Member } from "../model/Member";
import { Status } from "../model/assembly/Status";
import { Harvest } from "../model/assembly/Harvest";
import { Question } from "../model/Question";

type Props = {
  myFingerprint: Fingerprint;
  status: Status;
  sendClosedAnswer(answer: boolean): void;
  sendOpenAnswer(answer: string): void;
  sendQuestion(question: Question | null): void;
  acceptHarvest(): void;
  changeReadiness(r: Member.Blockingness): void;
  name: (member: Fingerprint) => Promise<Name>;
};

export default function StatusPanel(props: Props): JSX.Element {
  switch (props.status.tag) {
    case "waiting":
      return (
        <WaitingPanel
          myFingerprint={props.myFingerprint}
          waiting={props.status}
          sendOpenAnswer={props.sendOpenAnswer}
          sendClosedAnswer={props.sendClosedAnswer}
          sendQuestion={props.sendQuestion}
          changeReadiness={props.changeReadiness}
          name={props.name}
        />
      );
    case "harvesting":
      switch (props.status.phase.tag) {
        case "proposed":
          return (
            <ProposedPanel
              harvest={props.status.harvest}
              remaining={props.status.phase.remaining}
              name={props.name}
              acceptHarvest={props.acceptHarvest}
              changeReadiness={props.changeReadiness}
            />
          );
        case "started":
          return (
            <HarvestingStartedPanel
              harvest={props.status.harvest}
              name={props.name}
            />
          );
      }
    case "hidden":
      return <Hidden />;
  }
}

function HarvestingStartedPanel(props: {
  harvest: Harvest;
  name: (member: Fingerprint) => Promise<Name>;
}): JSX.Element {
  return (
    <section>
      <h3>La récolote est en cours</h3>
      <p>
        Le protocole de récolte anonyme est lancé. Tu auras les résultats dans
        quelques instants.
      </p>
    </section>
  );
}

function Hidden(): JSX.Element {
  return (
    <section>
      <h3>Veuillez attendre</h3>
      <p>Une récolte est en cours. Vous pourrez participer bientôt.</p>
    </section>
  );
}
