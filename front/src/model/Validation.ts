export namespace Valid {
  export function nickname(n: string): boolean {
    if (n && n !== "") {
      return true;
    } else {
      return false;
    }
  }

  export function id(u: string): boolean {
    if (u && u !== "") {
      return true;
    } else {
      return false;
    }
  }

  export function secret(s: string): boolean {
    if (s && s !== "") {
      return true;
    } else {
      return false;
    }
  }
}
