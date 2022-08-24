import { useState } from "react";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { Member } from "../model/Member";
import { Harvest } from "../model/assembly/Harvest";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  function goToAccepted() {
    props.acceptHarvest();
    setPhase("accepted");
  }

  let page: JSX.Element;

  switch (phase) {
    case "proposed":
      page = (
        <div>
          <h3>{t("Do you accept this harvest ?")}</h3>
          <p>
            {t(
              "Consent matters! The harvest won't start until everyone accepts it. Nobody is allowed to join the harvest any more, not until someone refuses it to go back!"
            )}
          </p>
          <div>
            <button
              className="yes-no-button"
              type="button"
              onClick={goToAccepted}
            >
              {t("I accept this harvest")}
            </button>
            <button
              className="yes-no-button"
              type="button"
              onClick={() => props.changeReadiness("blocking")}
            >
              {t("I refuse this harvest !")}
            </button>
          </div>
          <MemberList
            title={t("Participants in this harvest")}
            members={props.harvest.participants}
            name={props.name}
          />
        </div>
      );
      break;
    case "accepted":
      page = (
        <div>
          <h3>{t("Waiting others")}</h3>
          <p>
            {t(
              "You have accepted to start the harvest. You need to wait until everyone accepts the harvest or one refuses it."
            )}
          </p>
        </div>
      );
      break;
  }

  return (
    <section>
      {page}
      <MemberList
        title={t("Participants having not accept the harvest yet")}
        members={props.remaining}
        name={props.name}
      />
    </section>
  );
}
