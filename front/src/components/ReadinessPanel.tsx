import { MemberReadiness } from "../model/Member";
import { Fingerprint, Name } from "../model/Crypto";
import MemberList from "./MemberList";
import { useTranslation } from "react-i18next";

type Props = {
  readiness: MemberReadiness[];
  name: (member: Fingerprint) => Promise<Name>;
};

export default function ReadinessPanel(props: Props): JSX.Element {
  const { t } = useTranslation();

  let ready: Fingerprint[] = [];
  let blocking: Fingerprint[] = [];
  let answering: Fingerprint[] = [];

  for (let mr of props.readiness) {
    switch (mr.readiness) {
      case "ready":
        ready.push(mr.member);
        break;
      case "blocking":
        blocking.push(mr.member);
        break;
      case "answering":
        answering.push(mr.member);
        break;
    }
  }

  return (
    <div>
      <MemberList
        title={t("Members answering")}
        members={answering}
        name={props.name}
      />
      <MemberList
        title={t("Members blocking the harvest")}
        members={blocking}
        name={props.name}
      />
      <MemberList
        title={t("Members ready")}
        members={ready}
        name={props.name}
      />
    </div>
  );
}
