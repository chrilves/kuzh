use crate::{
    common::{Block, MaskID, Nonce, Role, SignedBlock, SignedTransaction, Transaction},
    crypto::{CryptoID, PublicKey, SecretKey},
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IdentityInfo {
    pub crypto_id: CryptoID,
    pub name: Option<String>,
    pub description: Option<String>,
    pub nonce: Nonce,
    pub role: Role,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Like {
    Like,
    Dislike,
}

pub mod events;
pub mod has_identity_info;
pub mod state;

pub use has_identity_info::*;
use never_type::Never;

use self::events::RoomEvent;

pub type RoomTransaction = Transaction<(), MaskID, Never, RoomEvent>;
pub type SignedRoomTransaction = SignedTransaction<(), MaskID, Never, RoomEvent>;
pub type RoomBlock = Block<(), MaskID, Never, RoomEvent>;
pub type RoomSignedBlock = SignedBlock<(), MaskID, Never, RoomEvent>;
