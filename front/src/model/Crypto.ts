import { Base64URL } from "../lib/Base64URL";
import { JSONNormalizedStringifyD } from "../lib/JSONNormalizedStringify";
import { Pair, PairNS } from "../lib/Pair";
import { AssemblyInfo } from "./assembly/AssembyInfo";
import { Parameters } from "./Parameters";

namespace CryptoConfig {
  export const hash = "SHA-256";

  export const encryptAlg = "RSA-OAEP-256";

  export const encryptionAlgorithm = "RSA-OAEP";
  export const singingAlgorithm = "RSA-PSS";

  export const rsaPssParams: RsaPssParams = {
    name: "RSA-PSS",
    saltLength: 32,
  };

  export function getAlgorithm(encrypt: Boolean): RsaHashedKeyGenParams {
    return {
      name: encrypt ? "RSA-OAEP" : "RSA-PSS",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: CryptoConfig.hash,
    };
  }
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
    return jwk;
  }

  export function importCryptoKey(key: JsonWebKey): Promise<CryptoKey> {
    return window.crypto.subtle.importKey(
      "jwk",
      key,
      {
        name:
          key.alg === CryptoConfig.encryptAlg
            ? CryptoConfig.encryptionAlgorithm
            : CryptoConfig.singingAlgorithm,
        hash: CryptoConfig.hash,
      },
      true,
      (key.key_ops ? key.key_ops : []) as KeyUsage[]
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
    readonly encryptPair: PairNS.Json<SerializedKey>;
    readonly nickname: Name;
  };

  export type Membership = {
    readonly assembly: AssemblyInfo;
    readonly me: Me;
  };

  export type IdentityProof = {
    readonly verify: JsonWebKey;
    readonly fingerprint: Fingerprint;
    readonly encrypt: Signed<JsonWebKey>;
    readonly nickname: Signed<string>;
  };
}

export type Fingerprint = string;

export class Me {
  readonly signPair: Pair<CryptoKey>;
  readonly encryptPair: Pair<CryptoKey>;
  readonly nickname: Name;
  readonly fingerprint: Fingerprint;

  private constructor(
    sgn: Pair<CryptoKey>,
    enc: Pair<CryptoKey>,
    nick: string,
    fingerprint: Name
  ) {
    this.signPair = sgn;
    this.encryptPair = enc;
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
      CryptoConfig.getAlgorithm(false),
      true,
      ["sign", "verify"]
    );
    const encryptKeyPair = await subtle.generateKey(
      CryptoConfig.getAlgorithm(true),
      true,
      ["encrypt", "decrypt"]
    );

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

    const me = await Me.make(
      new Pair(signKey, verifyKey),
      new Pair(decryptKey, encryptKey),
      nickname
    );

    return me;
  }

  readonly decrypt = (message: BufferSource): Promise<ArrayBuffer> =>
    window.crypto.subtle.decrypt(
      CryptoConfig.encryptionAlgorithm,
      this.encryptPair.private,
      message
    );

  readonly decryptBallot = async (encryptedBallot: string): Promise<string> => {
    const arr = new Uint8Array(
      await this.decrypt(Base64URL.getInstance().decode(encryptedBallot))
    );
    return Base64URL.getInstance().encode(arr.slice(Parameters.ballotSaltSize));
  };

  readonly sign = (message: BufferSource): Promise<ArrayBuffer> =>
    window.crypto.subtle.sign(
      CryptoConfig.rsaPssParams,
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
    const serialEncrypt = await this.encryptPair.map_async(
      Serial.serializeCryptoKey
    );

    return {
      signPair: serialSign,
      encryptPair: serialEncrypt,
      nickname: this.nickname,
    };
  };

  static async fromJson(p: Serial.Me): Promise<Me> {
    const sign = await Pair.fromJson(p.signPair).map_async(
      Serial.deSerializeCryptoKey
    );
    const encrypt = await Pair.fromJson(p.encryptPair).map_async(
      Serial.deSerializeCryptoKey
    );
    const me = Me.make(sign, encrypt, p.nickname);
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
  readonly encrypt: Signed<CryptoKey>;
  readonly nickname: Signed<string>;

  private constructor(
    verify: CryptoKey,
    fingerprint: Fingerprint,
    encrypt: Signed<CryptoKey>,
    nickname: Signed<string>
  ) {
    this.verify = verify;
    this.fingerprint = fingerprint;
    this.encrypt = encrypt;
    this.nickname = nickname;
  }

  static async make(me: Me): Promise<IdentityProof> {
    const fingerprint = await Serial.fingerprint(me.signPair.public);

    if (me.fingerprint !== fingerprint)
      throw new Error(
        `registered fingerprint ${me.fingerprint} does not match computed fingerprint ${fingerprint}.`
      );

    const te = new TextEncoder();
    const encryptKey = await Serial.serializeCryptoKey(me.encryptPair.public);
    const encryptSig = await me.signB64(te.encode(encryptKey));

    const nicknameSig = await me.signB64(te.encode(me.nickname));

    return new IdentityProof(
      me.signPair.public,
      fingerprint,
      {
        value: me.encryptPair.public,
        signature: encryptSig,
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
      this.encrypt.value
    );

    const encryptOK = this.verifySignature(
      this.encrypt.signature,
      serializedEncryptKey
    );

    if (!encryptOK) {
      throw new Error(
        `[KO] Encrypt signature ${this.encrypt.signature} verification failed.`
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
  ): Promise<boolean> => {
    return await window.crypto.subtle.verify(
      CryptoConfig.rsaPssParams,
      this.verify,
      Base64URL.getInstance().decode(sig),
      new TextEncoder().encode(message)
    );
  };

  readonly encryptArray = (message: BufferSource): Promise<ArrayBuffer> =>
    window.crypto.subtle.encrypt(
      CryptoConfig.encryptionAlgorithm,
      this.encrypt.value,
      message
    );

  readonly encryptBallot = async (ballot: Uint8Array): Promise<Uint8Array> => {
    const salt = new Uint8Array(Parameters.ballotSaltSize);
    window.crypto.getRandomValues(salt);
    const salted = new Uint8Array(salt.byteLength + ballot.byteLength);
    salted.set(salt, 0);
    salted.set(ballot, salt.byteLength);
    return new Uint8Array(await this.encryptArray(salted));
  };

  readonly toJson = async (): Promise<Serial.IdentityProof> => {
    const verify = await Serial.exportCryptoKey(this.verify);
    const encrypt = await Serial.exportCryptoKey(this.encrypt.value);

    return {
      verify: verify,
      fingerprint: this.fingerprint,
      encrypt: {
        value: encrypt,
        signature: this.encrypt.signature,
      },
      nickname: this.nickname,
    };
  };

  static async fromJson(p: Serial.IdentityProof): Promise<IdentityProof> {
    const verify = await Serial.importCryptoKey(p.verify);
    const encrypt = await Serial.importCryptoKey(p.encrypt.value);
    const ip = new IdentityProof(
      verify,
      p.fingerprint,
      {
        value: encrypt,
        signature: p.encrypt.signature,
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
