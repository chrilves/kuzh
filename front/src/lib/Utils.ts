import { JSONNormalizedStringifyD } from "./JSONNormalizedStringify";

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

export function sortJSON<A>(la: A[]): A[] {
  const m: Map<string, A> = new Map();
  const lh: string[] = [];

  for (const a of la) {
    const h = JSONNormalizedStringifyD(a);
    m.set(h, a);
    lh.push(h);
  }
  lh.sort();
  return lh.map((h) => {
    const r = m.get(h);
    if (r === undefined) throw new Error("But how???");
    else return r;
  });
}

export function checkListEqual<A>(l1: A[], l2: A[]): boolean {
  if (l1.length !== l2.length) return false;

  const sl1 = Array.from(l1).sort();
  const sl2 = Array.from(l2).sort();

  for (let i = 0; i < sl1.length; i++) if (sl1[i] !== sl2[i]) return false;

  return true;
}
