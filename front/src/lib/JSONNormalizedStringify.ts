const literals = new Set(["boolean", "number", "string"]);

export function JSONNormalizedStringify(
  json: any,
  counter?: number | undefined
): string | undefined {
  const tpe = typeof json;
  if (literals.has(tpe) || json === null) return JSON.stringify(json);

  if (tpe === "object")
    if (json instanceof Array) {
      let s = "[";
      let insert = false;
      for (const item of json) {
        let r = JSONNormalizedStringify(item);
        if (r === undefined) return undefined;
        else {
          s += `${insert ? "," : ""}${r}`;
          insert = true;
        }
      }
      return s + "]";
    } else {
      let s = "{";
      let insert = false;
      const entries = Object.entries(json);
      entries.sort((kv1, kv2) =>
        kv1[0] < kv2[0] ? -1 : kv1[0] > kv2[0] ? 1 : 0
      );
      for (const item of entries) {
        let key = item[0];
        let r = JSONNormalizedStringify(item[1]);
        if (r !== undefined) {
          s += `${insert ? "," : ""}${JSON.stringify(key)}:${r}`;
          insert = true;
        }
      }
      return s + "}";
    }
  else return undefined;
}

export function JSONNormalizedStringifyD(json: any): string {
  const r = JSONNormalizedStringify(json);
  return r === undefined ? "undefined" : r;
}
