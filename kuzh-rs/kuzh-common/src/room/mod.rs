use crate::{
    crypto::{CryptoID, PublicKey, SecretKey},
    newtypes::Nonce,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IdentityInfo<R> {
    pub crypto_id: CryptoID,
    pub name: Option<String>,
    pub description: Option<String>,
    pub nonce: Nonce,
    pub role: R,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Like {
    Like,
    Dislike,
}

pub mod events;
pub mod has_role;
pub mod state;

pub use has_role::*;
