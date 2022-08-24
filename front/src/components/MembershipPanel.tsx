import { Membership } from "../model/Crypto";
import { ID } from "./ID";
import { useTranslation } from "react-i18next";

type Props = {
  membership: Membership;
};

export default function MembershipPanel(props: Props): JSX.Element {
  const { t } = useTranslation();
  return (
    <ul>
      <li>
        {t("Assembly")}:
        <ID
          name={props.membership.assembly.name}
          id={props.membership.assembly.id}
        />
      </li>
      <li>
        {t("You")}:
        <ID
          name={props.membership.me.nickname}
          id={props.membership.me.fingerprint}
        />
      </li>
    </ul>
  );
}
