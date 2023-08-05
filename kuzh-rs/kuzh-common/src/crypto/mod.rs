pub mod primitives;
pub use self::primitives::{Bin, PublicKey, RingSig, SecretKey, Sig, CRYPTO_BIN_SIZE};

const MSG_SIZE: usize = 1024;

pub type EncryptedMessageData = [u8; MSG_SIZE];

pub struct Signed<A> {
    pub value: A,
    pub signature: Sig,
}

pub struct CryptoID {
    pub sign_key: PublicKey,
    pub encrypt_key: Signed<PublicKey>,
}
