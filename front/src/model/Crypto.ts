import { Base64URL } from "../lib/Base64URL";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Pair, PairNS } from "../lib/Pair";
import { AssemblyInfo } from "./assembly/AssembyInfo";

namespace CryptoConfig {
  export const hash = "SHA-256";

  export const aesKeyGenParams: AesKeyGenParams = {
    name: "AES-CBC",
    length: 256,
  };
  export const aesKeyBytes = aesKeyGenParams.length / 8;
  export const aesIvBytes = 16;

  export const dhAlgorithm = "ECDH";
  export const singingAlgorithm = "ECDSA";
  export const namedCurve = "P-384";
  export const dhKeySize = 97;

  export const alg = "ES384";
}

export type SerializedKey = string;
export type Name = string;
export type Signature = string;

export namespace CryptoUtils {
  export async function hash(obj: any): Promise<Uint8Array> {
    const serial = JSONNormalizedStringifyD(obj);
    const te = new TextEncoder();
    const hashArray = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      te.encode(serial)
    );
    return new Uint8Array(hashArray);
  }

  export function randomString(length: number): string {
    const arr = new Uint8Array(length);
    window.crypto.getRandomValues(arr);

    const uint6ToB64 = Base64URL.getInstance().uint6ToB64;

    let s = "";
    arr.forEach((b) => (s += uint6ToB64[b & 0x3f]));
    return s;
  }
}

export namespace Serial {
  export async function exportCryptoKey(key: CryptoKey): Promise<JsonWebKey> {
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    jwk.ext = true;
    jwk.alg = undefined;
    return jwk;
  }

  export function importCryptoKey(key: JsonWebKey): Promise<CryptoKey> {
    const usages = (key.key_ops ? key.key_ops : []) as KeyUsage[];

    return window.crypto.subtle.importKey(
      "jwk",
      key,
      {
        name:
          usages.length === 0 || usages[0] === "deriveBits"
            ? CryptoConfig.dhAlgorithm
            : CryptoConfig.singingAlgorithm,
        namedCurve: CryptoConfig.namedCurve,
      },
      true,
      usages
    );
  }

  export async function serializeCryptoKey(
    key: CryptoKey
  ): Promise<SerializedKey> {
    return JSONNormalizedStringifyD(await exportCryptoKey(key));
  }

  export function deSerializeCryptoKey(key: SerializedKey): Promise<CryptoKey> {
    return importCryptoKey(JSON.parse(key));
  }

  export async function fingerprint(key: CryptoKey): Promise<Fingerprint> {
    const verifyKey = await Serial.serializeCryptoKey(key);
    const te = new TextEncoder();
    const fingerprintAB = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      te.encode(verifyKey)
    );
    return Base64URL.getInstance().encode(new Uint8Array(fingerprintAB));
  }

  export type Me = {
    readonly signPair: PairNS.Json<SerializedKey>;
    readonly dhPair: PairNS.Json<SerializedKey>;
    readonly nickname: Name;
  };

  export type Membership = {
    readonly assembly: AssemblyInfo;
    readonly me: Me;
  };

  export type IdentityProof = {
    readonly verify: JsonWebKey;
    readonly fingerprint: Fingerprint;
    readonly dhPublic: Signed<JsonWebKey>;
    readonly nickname: Signed<string>;
  };
}

export type Fingerprint = string;

export class Me {
  readonly signPair: Pair<CryptoKey>;
  readonly dhPair: Pair<CryptoKey>;
  readonly nickname: Name;
  readonly fingerprint: Fingerprint;

  private constructor(
    sgn: Pair<CryptoKey>,
    dh: Pair<CryptoKey>,
    nick: string,
    fingerprint: Name
  ) {
    this.signPair = sgn;
    this.dhPair = dh;
    this.nickname = nick;
    this.fingerprint = fingerprint;
  }

  static async make(sgn: Pair<CryptoKey>, enc: Pair<CryptoKey>, nick: string) {
    const fingerprint = await Serial.fingerprint(sgn.public);
    return new Me(sgn, enc, nick, fingerprint);
  }

  static async generate(nickname: string): Promise<Me> {
    const subtle = window.crypto.subtle;

    const signKeyPair = await subtle.generateKey(
      {
        name: CryptoConfig.singingAlgorithm,
        namedCurve: CryptoConfig.namedCurve,
      },
      true,
      ["sign", "verify"]
    );
    const dhKeyPair = await subtle.generateKey(
      { name: CryptoConfig.dhAlgorithm, namedCurve: CryptoConfig.namedCurve },
      true,
      ["deriveBits"]
    );

    let dhPrivateKey: CryptoKey;
    if (dhKeyPair.privateKey) {
      dhPrivateKey = dhKeyPair.privateKey;
    } else {
      throw new Error("Null dh private key.");
    }

    let dhPublicKey: CryptoKey;
    if (dhKeyPair.publicKey) {
      dhPublicKey = dhKeyPair.publicKey;
    } else {
      throw new Error("Null dh public key.");
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

    const me = await Me.make(
      new Pair(signKey, verifyKey),
      new Pair(dhPrivateKey, dhPublicKey),
      nickname
    );

    return me;
  }

  readonly decrypt = async (message: Uint8Array): Promise<Uint8Array> => {
    const dhPubKey = await window.crypto.subtle.importKey(
      "raw",
      message.slice(0, CryptoConfig.dhKeySize),
      {
        name: CryptoConfig.dhAlgorithm,
        namedCurve: CryptoConfig.namedCurve,
      },
      true,
      []
    );
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: CryptoConfig.dhAlgorithm,
        public: dhPubKey,
      },
      this.dhPair.private,
      8 * (CryptoConfig.aesKeyBytes + CryptoConfig.aesIvBytes)
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecret.slice(0, CryptoConfig.aesKeyBytes),
      CryptoConfig.aesKeyGenParams.name,
      true,
      ["encrypt", "decrypt"]
    );

    return new Uint8Array(
      await window.crypto.subtle.decrypt(
        {
          name: CryptoConfig.aesKeyGenParams.name,
          iv: sharedSecret.slice(CryptoConfig.aesKeyBytes),
        },
        aesKey,
        message.slice(CryptoConfig.dhKeySize)
      )
    );
  };

  readonly sign = (message: BufferSource): Promise<ArrayBuffer> =>
    window.crypto.subtle.sign(
      {
        name: CryptoConfig.singingAlgorithm,
        hash: CryptoConfig.hash,
      },
      this.signPair.private,
      message
    );

  readonly signB64 = async (message: BufferSource): Promise<string> => {
    const arr = await this.sign(message);
    return Base64URL.getInstance().encode(new Uint8Array(arr));
  };

  readonly identityProof = async (): Promise<IdentityProof> =>
    IdentityProof.make(this);

  readonly toJson = async (): Promise<Serial.Me> => {
    const serialSign = await this.signPair.map_async(Serial.serializeCryptoKey);
    const serialDH = await this.dhPair.map_async(Serial.serializeCryptoKey);

    return {
      signPair: serialSign,
      dhPair: serialDH,
      nickname: this.nickname,
    };
  };

  static async fromJson(p: Serial.Me): Promise<Me> {
    const sign = await Pair.fromJson(p.signPair).map_async(
      Serial.deSerializeCryptoKey
    );
    const dh = await Pair.fromJson(p.dhPair).map_async(
      Serial.deSerializeCryptoKey
    );
    const me = Me.make(sign, dh, p.nickname);
    return me;
  }
}

export type Signed<A> = {
  readonly value: A;
  readonly signature: string;
};

export class IdentityProof {
  readonly verify: CryptoKey;
  readonly fingerprint: Fingerprint;
  readonly dhPublic: Signed<CryptoKey>;
  readonly nickname: Signed<string>;

  private constructor(
    verify: CryptoKey,
    fingerprint: Fingerprint,
    dhPublic: Signed<CryptoKey>,
    nickname: Signed<string>
  ) {
    this.verify = verify;
    this.fingerprint = fingerprint;
    this.dhPublic = dhPublic;
    this.nickname = nickname;
  }

  static async make(me: Me): Promise<IdentityProof> {
    const fingerprint = await Serial.fingerprint(me.signPair.public);

    if (me.fingerprint !== fingerprint)
      throw new Error(
        `registered fingerprint ${me.fingerprint} does not match computed fingerprint ${fingerprint}.`
      );

    const te = new TextEncoder();
    const dhKey = await Serial.serializeCryptoKey(me.dhPair.public);
    const dhSig = await me.signB64(te.encode(dhKey));

    const nicknameSig = await me.signB64(te.encode(me.nickname));

    return new IdentityProof(
      me.signPair.public,
      fingerprint,
      {
        value: me.dhPair.public,
        signature: dhSig,
      },
      {
        value: me.nickname,
        signature: nicknameSig,
      }
    );
  }

  readonly isValid = async (): Promise<boolean> => {
    const serializedVerifyKey: string = await Serial.serializeCryptoKey(
      this.verify
    );
    const te = new TextEncoder();

    const fingerprintAB = await window.crypto.subtle.digest(
      CryptoConfig.hash,
      te.encode(serializedVerifyKey)
    );
    const fingerprint = Base64URL.getInstance().encode(
      new Uint8Array(fingerprintAB)
    );

    if (fingerprint !== this.fingerprint) {
      throw new Error(
        `[KO] Fingerprints ${fingerprint} and ${this.fingerprint} don't match!`
      );
    }

    const serializedEncryptKey: string = await Serial.serializeCryptoKey(
      this.dhPublic.value
    );

    const encryptOK = this.verifySignature(
      this.dhPublic.signature,
      serializedEncryptKey
    );

    if (!encryptOK) {
      throw new Error(
        `[KO] DH public key signature ${this.dhPublic.signature} verification failed.`
      );
    }

    const nicknameOK = this.verifySignature(
      this.nickname.signature,
      this.nickname.value
    );

    if (!nicknameOK) {
      throw new Error(
        `[KO] Nickname ${this.nickname.value} signature ${this.nickname.signature} verification failed.`
      );
    }

    return true;
  };

  readonly verifySignature = async (
    sig: Signature,
    message: string
  ): Promise<boolean> =>
    window.crypto.subtle.verify(
      {
        name: CryptoConfig.singingAlgorithm,
        hash: CryptoConfig.hash,
      },
      this.verify,
      Base64URL.getInstance().decode(sig),
      new TextEncoder().encode(message)
    );

  readonly encryptIt = async (message: Uint8Array): Promise<Uint8Array> => {
    const dhEphemeral = await window.crypto.subtle.generateKey(
      {
        name: CryptoConfig.dhAlgorithm,
        namedCurve: CryptoConfig.namedCurve,
      },
      true,
      ["deriveBits"]
    );

    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: CryptoConfig.dhAlgorithm,
        public: this.dhPublic.value,
      },
      dhEphemeral.privateKey,
      8 * (CryptoConfig.aesKeyBytes + CryptoConfig.aesIvBytes)
    );

    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      sharedSecret.slice(0, CryptoConfig.aesKeyBytes),
      CryptoConfig.aesKeyGenParams.name,
      true,
      ["encrypt", "decrypt"]
    );

    const cypher = new Uint8Array(
      await window.crypto.subtle.encrypt(
        {
          name: CryptoConfig.aesKeyGenParams.name,
          iv: sharedSecret.slice(CryptoConfig.aesKeyBytes),
        },
        aesKey,
        message
      )
    );

    const dhPubRaw = new Uint8Array(
      await window.crypto.subtle.exportKey("raw", dhEphemeral.publicKey)
    );

    if (dhPubRaw.byteLength !== CryptoConfig.dhKeySize)
      throw new Error(
        `DH Pub size of ${dhPubRaw.byteLength} instead of ${CryptoConfig.dhKeySize}`
      );

    const enc = new Uint8Array(dhPubRaw.byteLength + cypher.byteLength);
    enc.set(dhPubRaw, 0);
    enc.set(cypher, dhPubRaw.byteLength);

    return enc;
  };

  readonly toJson = async (): Promise<Serial.IdentityProof> => {
    const verify = await Serial.exportCryptoKey(this.verify);
    const encrypt = await Serial.exportCryptoKey(this.dhPublic.value);

    return {
      verify: verify,
      fingerprint: this.fingerprint,
      dhPublic: {
        value: encrypt,
        signature: this.dhPublic.signature,
      },
      nickname: this.nickname,
    };
  };

  static async fromJson(p: Serial.IdentityProof): Promise<IdentityProof> {
    const verify = await Serial.importCryptoKey(p.verify);
    const dhPublic = await Serial.importCryptoKey(p.dhPublic.value);
    const ip = new IdentityProof(
      verify,
      p.fingerprint,
      {
        value: dhPublic,
        signature: p.dhPublic.signature,
      },
      p.nickname
    );

    if (await ip.isValid()) {
      return ip;
    } else {
      throw new Error("Invalid json identity proof");
    }
  }
}

export class Membership {
  readonly assembly: AssemblyInfo;
  readonly me: Me;

  constructor(asm: AssemblyInfo, m: Me) {
    this.assembly = asm;
    this.me = m;
  }

  readonly toJson = async (): Promise<Serial.Membership> => ({
    assembly: this.assembly,
    me: await this.me.toJson(),
  });

  static async fromJson(p: Serial.Membership): Promise<Membership> {
    return new Membership(p.assembly, await Me.fromJson(p.me));
  }
}
