export function withAsync<A>(f: () => Promise<A>): () => void {
  return () => {
    f();
    return () => {};
  };
}

export declare function structuredClone(value: any): any;
