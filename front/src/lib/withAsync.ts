export function withAsync<A>(f: () => Promise<A>): () => void {
  return () => {
    f();
    return () => {};
  };
}
