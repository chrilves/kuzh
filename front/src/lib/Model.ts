export type Nickname = {
  index: number,
  name: string
}

export type KeyPair = {
  privateKey: CryptoKey,
  publicKey: CryptoKey
}

export type Me = {
  readonly signKeyPair: KeyPair,
  readonly encryptKeyPair: KeyPair,
  nickname: Nickname
}

export namespace Me {
  export async function generate(nickname: string): Promise<Me> {
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

    return {
      signKeyPair: {
        privateKey: signKey,
        publicKey: verifyKey
      },
      encryptKeyPair: {
        privateKey: decryptKey,
        publicKey: encryptKey
      },
      nickname: {
        index: 0,
        name: nickname
      }
    }
  }


  export async function encrypt(me: Me, message: BufferSource): Promise<BufferSource> {
    return await window.crypto.subtle.encrypt(
      "RSA-OAEP",
      me.encryptKeyPair.privateKey,
      message
    )
  }

  export async function sign(me: Me, message: BufferSource): Promise<BufferSource> {
    return await window.crypto.subtle.sign(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      me.signKeyPair.privateKey,
      message
    )
  }

}

export type Assembly = {
  uuid: string,
  secret: string,
  name: string,
  me: Me
}

export type MemberStatus = "absent" | "busy" | "ready"