export type KeyPair = {
  readonly privateKey: CryptoKey,
  readonly publicKey: CryptoKey
}


export type SerializedKeyPair = {
  readonly privateKey: JsonWebKey,
  readonly publicKey: JsonWebKey
}

export namespace KeyPair {
  export async function serializeCryptoKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", key)
  } 

  export async function serialize(kp: KeyPair): Promise<SerializedKeyPair> {
    const privateKey = await serializeCryptoKey(kp.privateKey);
    const publicKey  = await serializeCryptoKey(kp.publicKey);
    return {
      privateKey: privateKey,
      publicKey: publicKey
    }
  }
}

export namespace SerializedKeyPair {
  export async function deSerializeCryptoKey(key: JsonWebKey): Promise<CryptoKey> {
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

  export async function deSerialize(kp: SerializedKeyPair): Promise<KeyPair> {
    const privateKey = await deSerializeCryptoKey(kp.privateKey);
    const publicKey  = await deSerializeCryptoKey(kp.publicKey);
    return {
      privateKey: privateKey,
      publicKey: publicKey
    }
  }
}

export type Me = {
  readonly signKeyPair: KeyPair,
  readonly encryptKeyPair: KeyPair,
  readonly nickname: string
}

export type SerializedMe = {
  readonly signKeyPair: SerializedKeyPair,
  readonly encryptKeyPair: SerializedKeyPair,
  readonly nickname: string
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
      nickname: nickname
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

  export async function serialize(me: Me): Promise<SerializedMe> {
    const signKeyPair = await KeyPair.serialize(me.signKeyPair);
    const encryptKeyPair = await KeyPair.serialize(me.encryptKeyPair);
    return {
      signKeyPair: signKeyPair,
      encryptKeyPair: encryptKeyPair,
      nickname: me.nickname
    }
  }
}

export namespace SerializedMe {
  export async function deSerialize(me: SerializedMe): Promise<Me> {
    const signKeyPair = await SerializedKeyPair.deSerialize(me.signKeyPair);
    const encryptKeyPair = await SerializedKeyPair.deSerialize(me.encryptKeyPair);
    return {
      signKeyPair: signKeyPair,
      encryptKeyPair: encryptKeyPair,
      nickname: me.nickname
    }
  }
}

export type Assembly = {
  readonly uuid: string,
  readonly secret: string,
  readonly name: string
}

export type Membership = {
  readonly assembly: Assembly,
  readonly me: Me
}

export type SerializedMembership = {
  readonly assembly: Assembly,
  readonly me: SerializedMe
}

export namespace Membership {
  export async function serialize(m: Membership): Promise<SerializedMembership> {
    const me = await Me.serialize(m.me);
    return  {
      assembly: m.assembly,
      me: me
    }
  } 
}

export namespace SerializedMembership {
  export async function deSerialize(m: SerializedMembership): Promise<Membership> {
    const me = await SerializedMe.deSerialize(m.me);
    return  {
      assembly: m.assembly,
      me: me
    }
  }
}

export type MemberStatus = "LOST" | "BUSY" | "READY"