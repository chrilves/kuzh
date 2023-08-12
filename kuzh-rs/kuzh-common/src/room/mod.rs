use crate::{
    crypto::{CryptoID, PublicKey, SecretKey},
    newtypes::Nonce,
};

pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

pub struct IdentityInfo {
    pub crypto_id: CryptoID,
    pub name: Option<String>,
    pub description: Option<String>,
    pub nonce: Nonce,
}

pub enum Like {
    Like,
    Dislike,
}

pub mod events;
pub mod states;
