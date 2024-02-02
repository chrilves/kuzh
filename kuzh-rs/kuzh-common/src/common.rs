use never_type::Never;

use crate::crypto::{Bin, Signed};
use std::collections::HashMap;
use std::marker::PhantomData;
use subtle::ConstantTimeEq;

macro_rules! id_type {
    ($newtype:ident,$basetype:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
        #[repr(transparent)]
        pub struct $newtype($basetype);

        impl $newtype {
            pub const MIN: $newtype = $newtype(0);
            pub const MAX: $newtype = $newtype($basetype::MAX);

            #[inline(always)]
            pub const fn next(&self) -> Option<$newtype> {
                if self.0 < $basetype::MAX {
                    Some($newtype(self.0 + 1))
                } else {
                    None
                }
            }

            #[inline(always)]
            pub const fn previous(&self) -> Option<$newtype> {
                if self.0 > 0 {
                    Some($newtype(self.0 - 1))
                } else {
                    None
                }
            }
        }

        impl From<$newtype> for usize {
            #[inline]
            fn from(val: $newtype) -> usize {
                val.0 as usize
            }
        }

        impl ConstantTimeEq for $newtype {
            #[inline]
            fn ct_eq(&self, other: &Self) -> subtle::Choice {
                self.0.ct_eq(&other.0)
            }
        }
    };
}

id_type!(UserID, u16);
id_type!(MaskID, u32);
id_type!(QuestionID, u16);
id_type!(AnswerID, u8);
id_type!(MessageID, u64);

#[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
#[repr(transparent)]
pub struct Hashed(Bin);

impl ConstantTimeEq for Hashed {
    #[inline]
    fn ct_eq(&self, other: &Self) -> subtle::Choice {
        self.0.ct_eq(&other.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
#[repr(transparent)]
pub struct Nonce(u64);

impl Nonce {
    #[inline]
    pub fn new() -> Nonce {
        Nonce(0)
    }

    #[inline]
    pub fn next(self) -> Nonce {
        Nonce(self.0 + 1)
    }
}

impl Default for Nonce {
    fn default() -> Self {
        Self::new()
    }
}

impl ConstantTimeEq for Nonce {
    #[inline]
    fn ct_eq(&self, other: &Self) -> subtle::Choice {
        self.0.ct_eq(&other.0)
    }
}

#[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
#[repr(transparent)]
pub struct BlockHeight<Event> {
    height: u64,
    _marker: PhantomData<Event>,
}

impl<Event> ConstantTimeEq for BlockHeight<Event> {
    #[inline]
    fn ct_eq(&self, other: &Self) -> subtle::Choice {
        self.height.ct_eq(&other.height)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum IdentityID<M, A> {
    RoomID,
    User(UserID),
    Mask(M),
    Answer(A),
}

pub type NodeIdentityID = IdentityID<Never, Never>;
pub type RoomIdentityID = IdentityID<MaskID, Never>;
pub type AnsweringIdentityID = IdentityID<MaskID, AnswerID>;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum QuestionKind {
    Open,
    Closed,
    Poll(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Question {
    pub id: QuestionID,
    pub from: RoomIdentityID,
    pub kind: QuestionKind,
    pub question: String,
    pub clarifications: Vec<String>,
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq)]
pub enum Role {
    Owner,
    Admin,
    Moderator,
    Regular,
    Banned,
}

impl Role {
    #[inline(always)]
    pub const fn can_moderate(self) -> bool {
        use Role::*;
        matches!(self, Owner | Admin | Moderator)
    }

    #[inline(always)]
    pub const fn is_banned(self) -> bool {
        matches!(self, Role::Banned)
    }
}

impl PartialOrd for Role {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Role {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        fn value(r: Role) -> u8 {
            use Role::*;
            match r {
                Owner => 0,
                Admin => 1,
                Moderator => 2,
                Regular => 3,
                Banned => 4,
            }
        }

        value(*self).cmp(&value(*other))
    }
}

pub struct PublicationRights<M, A> {
    pub role: Role,
    pub explicit: HashMap<IdentityID<M, A>, bool>,
}

pub type RoomPublicationRights = PublicationRights<MaskID, Never>;
pub type AnsweringPublicationRights = PublicationRights<MaskID, AnswerID>;

pub struct Transaction<ChainId, MaskId, AnswerId, Event> {
    pub chain: ChainId,
    pub from: IdentityID<MaskId, AnswerId>,
    pub event: Vec<Event>,
    pub nonce: Nonce,
}

pub type SignedTransaction<ChainId, MaskId, AnswerId, Event> =
    Signed<Transaction<ChainId, MaskId, AnswerId, Event>>;

pub struct Block<ChainId, MaskId, AnswerId, Event> {
    pub chain: ChainId,
    pub height: BlockHeight<Event>,
    pub parent_hash: Hashed,
    pub transactions: Vec<SignedTransaction<ChainId, MaskId, AnswerId, Event>>,
}

pub type SignedBlock<ChainId, MaskId, AnswerId, Event> =
    Signed<Block<ChainId, MaskId, AnswerId, Event>>;
