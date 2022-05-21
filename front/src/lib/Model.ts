export class Pair<A> {
  constructor(prv: A, pub: A) {
    this.private = prv;
    this.public = pub
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }
  
  readonly private: A
  readonly public: A

  map<B>(f: (a:A) => B): Pair<B> {
    return new Pair<B>(f(this.private), f(this.public));
  }

  async map_async<B>(f: (a:A) => Promise<B>): Promise<Pair<B>> {
    const prv = await f(this.private);
    const pub = await f(this.public);
    return Promise.resolve(new Pair<B>(prv, pub));
  }

  toJson(): object {
    return {
      private: this.private,
      public: this.public
    }  
  }
}

export namespace Pair {
  export type Json<A> = {private: A, public: A};

  export function fromJson<A>(p: Json<A>): Pair<A> {
    return new Pair<A>(p.private, p.public);
  }
}

export type SerialiedKey = JsonWebKey;
export type KeyPair = Pair<CryptoKey>;
export type SerializedKeyPair = Pair<SerialiedKey>;

export namespace Serial {
  export async function serializeCryptoKey(key: CryptoKey): Promise<SerialiedKey> {
    return await window.crypto.subtle.exportKey("jwk", key)
  }

  export async function deSerializeCryptoKey(key: SerialiedKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      "jwk",
      key,
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      true,
      ((key.key_ops ? key.key_ops : []) as KeyUsage[])
    );
  }
}

export class Me<A> {
  readonly signPair: Pair<A>;
  readonly encryptPair: Pair<A>;
  readonly nickname: string;

  constructor(sgn: Pair<A>, enc: Pair<A>, nick: string) {
    this.signPair = sgn;
    this.encryptPair = enc;
    this.nickname = nick;
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }

  map<B>(f: (a:A) => B): Me<B> {
    return new Me(this.signPair.map(f), this.encryptPair.map(f), this.nickname);
  }

  async map_async<B>(f: (a:A) => Promise<B>): Promise<Me<B>> {
    const sgn = await this.signPair.map_async(f);
    const enc = await this.encryptPair.map_async(f);
    return Promise.resolve(new Me<B>(sgn, enc, this.nickname));
  }

  toJson(): object {
    return {
      signKeyPair: this.signPair.toJson(),
      encryptKeyPair: this.encryptPair.toJson(),
      nickname: this.nickname
    }
  }
}

export namespace Me {
  export type Json<A> = {signPair: Pair.Json<A>, encryptPair: Pair.Json<A>, nickname: string};

  export function fromJson<A>(p: Json<A>): Me<A> {
    return new Me<A>(Pair.fromJson(p.signPair), Pair.fromJson(p.encryptPair), p.nickname);
  }
}


export type CrytoMe = Me<CryptoKey>;
export type SerialiedMe = Me<SerialiedKey>;

export namespace CryptoMe {
  export async function generate(nickname: string): Promise<Me<CryptoKey>> {
    function getAlgorithm(encrypt: Boolean): RsaHashedKeyGenParams {
      return {
        name: encrypt ? "RSA-OAEP" : "RSA-PSS",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-512"
      }
    }

    const subtle = window.crypto.subtle
  
    const signKeyPair = await subtle.generateKey(
      getAlgorithm(false),
      true,
      ["encrypt", "decrypt"]
    );
    const encryptKeyPair = await subtle.generateKey(
      getAlgorithm(false),
      true,
      ["sign", "verify"]
    );

    let decryptKey: CryptoKey;
    if (encryptKeyPair.privateKey) {
      decryptKey = encryptKeyPair.privateKey;
    } else {
      throw new Error("Null decrypt public key.")
    }

    let encryptKey: CryptoKey;
    if (encryptKeyPair.publicKey) {
      encryptKey = encryptKeyPair.publicKey;
    } else {
      throw new Error("Null encrypt private key.")
    }

    let signKey: CryptoKey;
    if (signKeyPair.privateKey) {
      signKey = signKeyPair.privateKey;
    } else {
      throw new Error("Null sign private key.")
    }

    let verifyKey: CryptoKey;
    if (signKeyPair.publicKey) {
      verifyKey = signKeyPair.publicKey;
    } else {
      throw new Error("Null verify public key.")
    }

    return new Me(
      new Pair(signKey,verifyKey),
      new Pair(decryptKey, encryptKey),
      nickname
    );
  }


  export async function encrypt(me: Me<CryptoKey>, message: BufferSource): Promise<BufferSource> {
    return await window.crypto.subtle.encrypt(
      "RSA-OAEP",
      me.encryptPair.private,
      message
    )
  }

  export async function sign(me: Me<CryptoKey>, message: BufferSource): Promise<BufferSource> {
    return await window.crypto.subtle.sign(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      me.signPair.private,
      message
    )
  }
}


export type Assembly = {
  readonly uuid: string,
  readonly secret: string,
  readonly name: string
}

export class Membership<A> {
  readonly assembly: Assembly;
  readonly me: Me<A>;

  constructor(asm: Assembly, m: Me<A>) {
    this.assembly = asm;
    this.me = m;
    this.map = this.map.bind(this);
    this.map_async = this.map_async.bind(this);
    this.toJson = this.toJson.bind(this);
  }

  map<B>(f: (a:A) => B): Membership<B> {
    return new Membership(this.assembly, this.me.map(f));
  }

  async map_async<B>(f: (a:A) => Promise<B>): Promise<Membership<B>> {
    const me = await this.me.map_async(f);
    return Promise.resolve(new Membership<B>(this.assembly, me));
  }

  toJson(): object {
    return {
      assembly: this.assembly,
      me: this.me.toJson()
    }
  }
}

export namespace Membership {
  export type Json<A> = {assembly: Assembly, me: Me.Json<A>};

  export function fromJson<A>(p: Json<A>): Membership<A> {
    return new Membership<A>(p.assembly, Me.fromJson(p.me));
  }
}

export type MemberStatus = "LOST" | "BUSY" | "READY"