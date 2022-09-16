import { useTranslation } from "react-i18next";
import { Harvest } from "../model/assembly/Harvest";
import { Status } from "../model/assembly/Status";
import { Fingerprint, Name } from "../model/Crypto";
import { Member } from "../model/Member";
import { Question } from "../model/Question";
import ProposedPanel, { Action } from "./ProposedPanel";
import WaitingPanel from "./WaitingPanel";

type Props = {
  myFingerprint: Fingerprint;
  status: Status;
  sendClosedAnswer(answer: boolean): void;
  sendOpenAnswer(answer: string): void;
  sendQuestion(question: Question | null): void;
  acceptHarvest(): void;
  refuseHarvest(): void;
  changeReadiness(r: Member.Blockingness): void;
  name: (member: Fingerprint) => Promise<Name>;
  autoConfirm: boolean;
  autoAccept: boolean;
  disableBlocking: boolean;
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
          autoConfirm={props.autoConfirm}
          disableBlocking={props.disableBlocking}
        />
      );
    case "harvesting":
      const phase = props.status.phase;
      switch (phase.tag) {
        case "proposed":
          const proposedPhase =
            phase.remaining.findIndex((x) => x === props.myFingerprint) === -1
              ? "accepted"
              : "proposed";

          const act = (action: Action) => {
            switch (action) {
              case "accept":
                props.acceptHarvest();
                break;
              case "refuse":
                props.refuseHarvest();
                break;
              case "block":
                if (props.autoAccept) props.refuseHarvest();
                else props.changeReadiness("blocking");
                break;
            }
          };

          return (
            <ProposedPanel
              harvest={props.status.harvest}
              remaining={phase.remaining}
              name={props.name}
              phase={proposedPhase}
              act={act}
              autoAccept={props.autoAccept}
              disableBlocking={props.disableBlocking}
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
      break;
    case "hidden":
      return <Hidden />;
  }
}

function HarvestingStartedPanel(props: {
  harvest: Harvest;
  name: (member: Fingerprint) => Promise<Name>;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <section>
      <h3>{t("The harvest is in progress")}</h3>
      <p>
        {t(
          "The protocol of anonymous harvesting is in progress. You'll have the results in a moment."
        )}
      </p>
    </section>
  );
}

function Hidden(): JSX.Element {
  const { t } = useTranslation();

  return (
    <section>
      <h3>{t("Please wait")}</h3>
      <p>
        {t("A harvest is in progress. You'll be able to participate soon.")}
      </p>
    </section>
  );
}
