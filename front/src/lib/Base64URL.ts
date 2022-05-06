export class Base64URL {
  readonly b64ToUint6: Uint16Array;
  readonly uint6ToB64: string[];
  static instance: Base64URL | null;

  constructor() {
    const arrays = Base64URL.codingArrays();
    this.b64ToUint6 = arrays.b64ToUint6;
    this.uint6ToB64 = arrays.uint6ToB64;
    this.encode = this.encode.bind(this);
    this.decode = this.decode.bind(this);
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new Base64URL();
    }
    return this.instance;
  }

  static codingArrays(): {
    uint6ToB64: string[];
    b64ToUint6: Uint16Array;
  } {
    const uint6ToB64 = new Array<string>(64);
    const b64ToUint6 = new Uint16Array(123);

    const A = "A".charCodeAt(0);
    const a = "a".charCodeAt(0);
    const _0 = "0".charCodeAt(0);
    let charCode: number;

    for (let i = 0; i < 62; i++) {
      if (i < 26) {
        charCode = A + i;
      } else if (i < 52) {
        charCode = a + (i - 26);
      } else {
        charCode = _0 + (i - 52);
      }
      uint6ToB64[i] = String.fromCharCode(charCode);
      b64ToUint6[charCode] = i;
    }

    uint6ToB64[62] = "-";
    b64ToUint6["-".charCodeAt(0)] = 62;

    uint6ToB64[63] = "_";
    b64ToUint6["_".charCodeAt(0)] = 63;

    return {
      uint6ToB64: uint6ToB64,
      b64ToUint6: b64ToUint6,
    };
  }

  encode(arr: Uint8Array): string {
    let out = "";

    for (let offset = 0; offset + 2 < arr.length; offset += 3) {
      let b0 = arr[offset];
      out += this.uint6ToB64[(b0 & 0xfc) >>> 2];
      let b1 = arr[offset + 1];
      out += this.uint6ToB64[((b0 & 0x03) << 4) | ((b1 & 0xf0) >>> 4)];
      let b2 = arr[offset + 2];
      out += this.uint6ToB64[((b1 & 0x0f) << 2) | ((b2 & 0xc0) >>> 6)];
      out += this.uint6ToB64[b2 & 0x3f];
    }

    const rest = arr.length % 3;

    if (rest === 1) {
      let b0 = arr[arr.length - 1];
      out += this.uint6ToB64[(b0 & 0xfc) >>> 2];
      out += this.uint6ToB64[(b0 & 0x03) << 4];
      out += "==";
    }

    if (rest === 2) {
      let b0 = arr[arr.length - 2];
      out += this.uint6ToB64[(b0 & 0xfc) >>> 2];
      let b1 = arr[arr.length - 1];
      out += this.uint6ToB64[((b0 & 0x03) << 4) | ((b1 & 0xf0) >>> 4)];
      out += this.uint6ToB64[(b1 & 0x0f) << 2];
      out += "=";
    }

    return out;
  }

  decode(str: string): Uint8Array {
    const padding: number = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0;
    const size =
      Math.floor((str.length - padding) / 4) * 3 + [0, 2, 1][padding];
    const out = new Uint8Array(size);
    let pos = 0;

    for (let offset = 0; offset + 3 < str.length - padding; offset += 4) {
      let c0 = this.b64ToUint6[str.charCodeAt(offset)];
      let c1 = this.b64ToUint6[str.charCodeAt(offset + 1)];
      out[pos++] = (c0 << 2) | ((c1 & 0x30) >>> 4);

      let c2 = this.b64ToUint6[str.charCodeAt(offset + 2)];
      out[pos++] = ((c1 & 0x0f) << 4) | ((c2 & 0x3c) >> 2);

      let c3 = this.b64ToUint6[str.charCodeAt(offset + 3)];
      out[pos++] = ((c2 & 0x03) << 6) | c3;
    }

    if (padding === 1) {
      const offset = str.length - 4;
      let c0 = this.b64ToUint6[str.charCodeAt(offset)];
      let c1 = this.b64ToUint6[str.charCodeAt(offset + 1)];
      out[pos++] = (c0 << 2) | ((c1 & 0x30) >>> 4);

      let c2 = this.b64ToUint6[str.charCodeAt(offset + 2)];
      out[pos++] = ((c1 & 0x0f) << 4) | ((c2 & 0x3c) >> 2);
    }

    if (padding === 2) {
      const offset = str.length - 4;
      let c0 = this.b64ToUint6[str.charCodeAt(offset)];
      let c1 = this.b64ToUint6[str.charCodeAt(offset + 1)];
      out[pos++] = (c0 << 2) | ((c1 & 0x30) >>> 4);
    }

    return out;
  }
}
