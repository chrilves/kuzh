export function Nickname(props: {
  nickname: string;
  setNickname(nickname: string): void;
}): JSX.Element {
  return (
    <div>
      <label>Choisi un pseudo : </label>
      <input
        type="text"
        name="nickname"
        placeholder="vote pseudo"
        value={props.nickname}
        onChange={(e) => props.setNickname(e.target.value)}
      />
    </div>
  );
}
