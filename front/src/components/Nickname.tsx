import { useTranslation } from "react-i18next";

export function Nickname(props: {
  nickname: string;
  setNickname(nickname: string): void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <label>{t("Choose a nickname")} : </label>
      <input
        type="text"
        name="nickname"
        placeholder={t("your nickname")}
        value={props.nickname}
        onChange={(e) => props.setNickname(e.target.value)}
      />
    </div>
  );
}
