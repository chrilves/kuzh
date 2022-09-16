import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Harvest } from "../model/assembly/Harvest";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";

type Props = {
  harvest: Harvest;
  remaining: Fingerprint[];
  name(member: Fingerprint): Promise<Name>;
  phase: Phase;
  act: (action: Action) => void;
  autoAccept: Boolean;
  disableBlocking: boolean;
};

export type Phase = "proposed" | "accepted";
export type Action = "accept" | "refuse" | "block";

export default function ProposedPanel(props: Props): JSX.Element {
  const [desiredPhase, setDesiredPhase] = useState<Phase>(
    props.autoAccept ? "accepted" : props.phase
  );
  const { t } = useTranslation();

  const act = (action: Action) => {
    props.act(action);
    setDesiredPhase(action === "accept" ? "accepted" : "proposed");
  };

  let page: JSX.Element;

  if (desiredPhase !== props.phase)
    page = <p>{t("Waiting server acknowledgement")}</p>;
  else
    switch (props.phase) {
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
                className={
                  props.disableBlocking ? "yes-no-button" : "third-button"
                }
                type="button"
                onClick={() => act("accept")}
              >
                {t("I accept it.")}
              </button>
              <button
                className={
                  props.disableBlocking ? "yes-no-button" : "third-button"
                }
                type="button"
                onClick={() => act("refuse")}
              >
                {t("I refuse it!")}
              </button>
              {!props.disableBlocking && (
                <button
                  className="third-button"
                  type="button"
                  onClick={() => act("block")}
                >
                  {t("I block it!")}
                </button>
              )}
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
                "You need to wait until everyone accepts the harvest or one refuses it."
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
