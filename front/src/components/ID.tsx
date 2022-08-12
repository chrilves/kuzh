export function ID(props: { name: string; id: string }): JSX.Element {
  return (
    <div>
      <span className="name">{props.name}</span>
      <span className="id">{props.id}</span>
    </div>
  );
}
