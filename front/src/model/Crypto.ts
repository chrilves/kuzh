import { Base64URL } from "../lib/Base64URL";

export namespace CryptoConfig {
  export const hash = "SHA-256";
  export const encryptAlg = "RSA-OAEP-256";
}

export namespace Valid {
  export function nickname(n: string): boolean {
    if (n && n !== "") {
      return true;
    } else {
      return false;
    }
  }

  export function uuid(u: string): boolean {
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

export class Pair<A> {
  constructor(prv: A, pub: A) {
    this.private = prv;
    this.public = pub;
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }

  readonly private: A;
  readonly public: A;

  map<B>(f: (a: A) => B): Pair<B> {
    return new Pair<B>(f(this.private), f(this.public));
  }

  async map_async<B>(f: (a: A) => Promise<B>): Promise<Pair<B>> {
    const prv = await f(this.private);
    const pub = await f(this.public);
    return new Pair<B>(prv, pub);
  }

  toJson(): Pair.Json<A> {
    return {
      private: this.private,
      public: this.public,
    };
  }
}

export namespace Pair {
  export type Json<A> = { private: A; public: A };

  export function fromJson<A>(p: Json<A>): Pair<A> {
    return new Pair<A>(p.private, p.public);
  }
}

export type SerializedKey = string;
export type KeyPair = Pair<CryptoKey>;
export type SerializedKeyPair = Pair<SerializedKey>;

export type Name = string;

export namespace Serial {
  export function serializedKey2str(s: JsonWebKey): string {
    return JSON.stringify(s, Object.keys(s).sort());
  }

  export async function serializeCryptoKey(
    key: CryptoKey
  ): Promise<SerializedKey> {
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    return serializedKey2str(jwk);
  }

  export async function deSerializeCryptoKey(
    skey: SerializedKey
  ): Promise<CryptoKey> {
    const key: JsonWebKey = JSON.parse(skey);
    return await window.crypto.subtle.importKey(
      "jwk",
      key,
      {
        name: key.alg === CryptoConfig.encryptAlg ? "RSA-OAEP" : "RSA-PSS",
        hash: CryptoConfig.hash,
      },
      true,
      (key.key_ops ? key.key_ops : []) as KeyUsage[]
    );
  }
}

export type Signed<A> = {
  value: A;
  signature: string;
};

export type Fingerprint = string;

export type IdentityProof = {
  verify: SerializedKey;
  fingerprint: Fingerprint;
  encrypt: Signed<SerializedKey>;
  nickname: Signed<string>;
};

export class Me<A> {
  readonly signPair: Pair<A>;
  readonly encryptPair: Pair<A>;
  readonly nickname: Name;
  readonly fingerprint: Fingerprint;

  constructor(sgn: Pair<A>, enc: Pair<A>, nick: string, fingerprint: Name) {
    this.signPair = sgn;
    this.encryptPair = enc;
    this.nickname = nick;
    this.fingerprint = fingerprint;
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }

  map<B>(f: (a: A) => B): Me<B> {
    return new Me(
      this.signPair.map(f),
      this.encryptPair.map(f),
      this.nickname,
      this.fingerprint
    );
  }

  async map_async<B>(f: (a: A) => Promise<B>): Promise<Me<B>> {
    const sgn = await this.signPair.map_async(f);
    const enc = await this.encryptPair.map_async(f);
    return new Me<B>(sgn, enc, this.nickname, this.fingerprint);
  }

  toJson(): Me.Json<A> {
    return {
      signPair: this.signPair.toJson(),
      encryptPair: this.encryptPair.toJson(),
      nickname: this.nickname,
      fingerprint: this.fingerprint,
    };
  }
}

export namespace Me {
  export type Json<A> = {
    signPair: Pair.Json<A>;
    encryptPair: Pair.Json<A>;
    nickname: Name;
    fingerprint: Fingerprint;
  };

  export function fromJson<A>(p: Json<A>): Me<A> {
    return new Me<A>(
      Pair.fromJson(p.signPair),
      Pair.fromJson(p.encryptPair),
      p.nickname,
      p.fingerprint
    );
  }
}

export type CryptoMe = Me<CryptoKey>;
export type SerialiedMe = Me<SerializedKey>;

export namespace CryptoMe {
  export async function generate(nickname: string): Promise<Me<CryptoKey>> {
    function getAlgorithm(encrypt: Boolean): RsaHashedKeyGenParams {
      return {
        name: encrypt ? "RSA-OAEP" : "RSA-PSS",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: CryptoConfig.hash,
      };
    }

    const subtle = window.crypto.subtle;

    const signKeyPair = await subtle.generateKey(getAlgorithm(false), true, [
      "sign",
      "verify",
    ]);
    const encryptKeyPair = await subtle.generateKey(getAlgorithm(true), true, [
      "encrypt",
      "decrypt",
    ]);

    let decryptKey: CryptoKey;
    if (encryptKeyPair.privateKey) {
      decryptKey = encryptKeyPair.privateKey;
    } else {
      throw new Error("Null decrypt public key.");
    }

    let encryptKey: CryptoKey;
    if (encryptKeyPair.publicKey) {
      encryptKey = encryptKeyPair.publicKey;
    } else {
      throw new Error("Null encrypt private key.");
    }

    let signKey: CryptoKey;
    if (signKeyPair.privateKey) {
      signKey = signKeyPair.privateKey;
    } else {
      throw new Error("Null sign private key.");
    }

    let verifyKey: CryptoKey;
    if (signKeyPair.publicKey) {
      verifyKey = signKeyPair.publicKey;
    } else {
      throw new Error("Null verify public key.");
    }

    const verifyKeySerial = await Serial.serializeCryptoKey(verifyKey);
    const fingerprintAB = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      new TextEncoder().encode(verifyKeySerial)
    );
    const fingerprint = Base64URL.getInstance().encode(
      new Uint8Array(fingerprintAB)
    );

    console.log(`Fingerprint : '${fingerprint}'`);

    return new Me(
      new Pair(signKey, verifyKey),
      new Pair(decryptKey, encryptKey),
      nickname,
      fingerprint
    );
  }

  export async function encrypt(
    me: Me<CryptoKey>,
    message: BufferSource
  ): Promise<ArrayBuffer> {
    return await window.crypto.subtle.encrypt(
      "RSA-OAEP",
      me.encryptPair.private,
      message
    );
  }

  export const rsaPssParams: RsaPssParams = {
    name: "RSA-PSS",
    saltLength: 32,
  };

  export async function sign(
    me: Me<CryptoKey>,
    message: BufferSource
  ): Promise<ArrayBuffer> {
    return await window.crypto.subtle.sign(
      rsaPssParams,
      me.signPair.private,
      message
    );
  }

  export async function signB64(
    me: Me<CryptoKey>,
    message: BufferSource
  ): Promise<string> {
    const arr = await sign(me, message);
    return Base64URL.getInstance().encode(new Uint8Array(arr));
  }

  export async function identityProof(
    me: Me<CryptoKey>
  ): Promise<IdentityProof> {
    const verifyKey = await Serial.serializeCryptoKey(me.signPair.public);
    const te = new TextEncoder();

    const fingerprintAB = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      te.encode(verifyKey)
    );
    const fingerprint = Base64URL.getInstance().encode(
      new Uint8Array(fingerprintAB)
    );

    if (me.fingerprint !== fingerprint)
      throw new Error(
        `registered fingerprint ${me.fingerprint} does not match computed fingerprint ${fingerprint}.`
      );

    const encryptKey = await Serial.serializeCryptoKey(me.encryptPair.public);
    const encryptSig = await signB64(me, te.encode(encryptKey));

    const nicknameSig = await signB64(me, te.encode(me.nickname));

    return {
      verify: verifyKey,
      fingerprint: fingerprint,
      encrypt: {
        value: encryptKey,
        signature: encryptSig,
      },
      nickname: {
        value: me.nickname,
        signature: nicknameSig,
      },
    };
  }

  export async function verifyIdentityProof(
    i: IdentityProof
  ): Promise<boolean> {
    console.log("Deserializing verification key.");
    const verifyKey: CryptoKey = await Serial.deSerializeCryptoKey(i.verify);
    console.log("Deserialized verification key.");
    const te = new TextEncoder();
    const base64 = Base64URL.getInstance();

    const fingerprintAB = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      te.encode(i.verify)
    );
    const fingerprint = Base64URL.getInstance().encode(
      new Uint8Array(fingerprintAB)
    );

    if (fingerprint !== i.fingerprint) {
      throw new Error(
        `[KO] Fingerprints ${fingerprint} and ${i.fingerprint} don't match!`
      );
    } else {
      console.log(`[OK] Fingerprint ${fingerprint} is OK.`);
    }

    const encryptOK = await window.crypto.subtle.verify(
      CryptoMe.rsaPssParams,
      verifyKey,
      base64.decode(i.encrypt.signature),
      te.encode(i.encrypt.value)
    );

    if (!encryptOK) {
      throw new Error(
        `[KO] Encrypt signature ${i.encrypt.signature} verification failed.`
      );
    } else {
      console.log(
        `[OK] Encrypt signature ${i.encrypt.signature} verification OK.`
      );
    }

    const nicknameOK = await window.crypto.subtle.verify(
      CryptoMe.rsaPssParams,
      verifyKey,
      base64.decode(i.nickname.signature),
      te.encode(i.nickname.value)
    );

    if (!nicknameOK) {
      throw new Error(
        `[KO] Nickname ${i.nickname.value} signature ${i.nickname.signature} verification failed.`
      );
    } else {
      console.log(
        `[OK] Nickname ${i.nickname.value} signature ${i.nickname.signature} verification OK.`
      );
    }

    return true;
  }
}

export type AssemblyInfo = {
  readonly uuid: string;
  readonly secret: string;
  readonly name: string;
};

export class Membership<A> {
  readonly assembly: AssemblyInfo;
  readonly me: Me<A>;

  constructor(asm: AssemblyInfo, m: Me<A>) {
    this.assembly = asm;
    this.me = m;
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }

  map<B>(f: (a: A) => B): Membership<B> {
    return new Membership(this.assembly, this.me.map(f));
  }

  async map_async<B>(f: (a: A) => Promise<B>): Promise<Membership<B>> {
    const me = await this.me.map_async(f);
    return new Membership<B>(this.assembly, me);
  }

  toJson(): Membership.Json<A> {
    return {
      assembly: this.assembly,
      me: this.me.toJson(),
    };
  }
}

export namespace Membership {
  export type Json<A> = { assembly: AssemblyInfo; me: Me.Json<A> };

  export function fromJson<A>(p: Json<A>): Membership<A> {
    return new Membership<A>(p.assembly, Me.fromJson(p.me));
  }
}

export type CryptoMembership = Membership<CryptoKey>;
export type SerializedMembership = Membership<SerializedKey>;

export type MemberStatus = "LOST" | "BUSY" | "READY";
