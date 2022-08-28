export type AssemblyInfo = {
  readonly id: string;
  readonly secret: string;
  readonly name: string;
};

export namespace AsssemblyInfo {
  export function parseAssemblyURL(
    url: String
  ): { id: string; name: string | null; secret: string } | null {
    try {
      const re = /.*[/]([^/]+)\?(.*)/;
      const match = url.match(re);

      if (match === null) return null;

      const id = match[1];
      const qs: Map<string, string> = new Map();

      const kvre = /([^=]+)=(.*)/;

      for (const pair of match[2].split("&")) {
        const kv = pair.match(kvre);
        if (kv) qs.set(kv[1], kv[2]);
      }

      const secret = qs.get("secret");

      if (secret === undefined) return null;

      let name: string | null | undefined = qs.get("name");

      if (name !== undefined) name = decodeURIComponent(name);
      else name = null;

      return { id, name, secret };
    } catch (e) {
      console.log(`${e}`);
      return null;
    }
  }
}
