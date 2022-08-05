export function withAsync<A>(f: () => Promise<A>): () => void {
  return () => {
    f();
    return () => {};
  };
}

export declare function structuredClone(value: any): any;

export function isOrdered(l: string[]): boolean {
  if (l.length <= 1) return true;

  for (let i = 0; i < l.length - 2; i++) if (l[i] > l[i + 1]) return false;
  return true;
}

export function isDistinct(l: string[]): boolean {
  let set = new Set();
  for (const x of l) set.add(x);
  return set.size === l.length;
}
