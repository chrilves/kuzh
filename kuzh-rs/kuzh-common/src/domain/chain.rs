use std::marker::PhantomData;

use subtle::ConstantTimeEq;

use crate::crypto::{Bin, Signed};

use super::identity::IdentityID;

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

pub struct Transaction<ChainId, MaskId, AnswerId, Event> {
    pub chain: ChainId,
    pub from: IdentityID<MaskId, AnswerId>,
    pub event: Vec<Event>,
    pub nonce: Nonce,
}

pub type SignedTransaction<ChainId, MaskId, AnswerId, Event> =
    Signed<Transaction<ChainId, MaskId, AnswerId, Event>>;

#[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
#[repr(transparent)]
pub struct Hashed(Bin);

impl ConstantTimeEq for Hashed {
    #[inline]
    fn ct_eq(&self, other: &Self) -> subtle::Choice {
        self.0.ct_eq(&other.0)
    }
}

pub struct Block<ChainId, MaskId, AnswerId, Event> {
    pub chain: ChainId,
    pub height: BlockHeight<Event>,
    pub parent_hash: Hashed,
    pub transactions: Vec<SignedTransaction<ChainId, MaskId, AnswerId, Event>>,
}

pub type SignedBlock<ChainId, MaskId, AnswerId, Event> =
    Signed<Block<ChainId, MaskId, AnswerId, Event>>;
