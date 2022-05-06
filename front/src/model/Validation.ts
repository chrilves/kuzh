export namespace Validation {
  export function nickname(n: string): boolean {
    if (n && n.trim()) {
      return true;
    } else {
      return false;
    }
  }

  export function id(u: string): boolean {
    if (u && u.trim()) {
      return true;
    } else {
      return false;
    }
  }

  export function secret(s: string): boolean {
    if (s && s.trim()) {
      return true;
    } else {
      return false;
    }
  }

  export function assemblyName(s: string): boolean {
    if (s && s.trim()) {
      return true;
    } else {
      return false;
    }
  }
}
