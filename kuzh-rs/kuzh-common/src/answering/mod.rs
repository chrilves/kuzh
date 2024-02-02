use crate::{
    common::{
        AnswerID, Block, IdentityID, MaskID, QuestionID, SignedBlock, SignedTransaction,
        Transaction,
    },
    crypto::{PublicKey, RingSig, SecretKey, Sig},
};

use self::events::AnsweringEvent;

pub type AnsweringIdentityID = IdentityID<AnswerID>;
pub const ANSWER_SIZE: usize = 300;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub iteration: u64,
    pub answer: [u8; ANSWER_SIZE],
    pub ring_sig: RingSig,
    pub sig: Sig,
}

impl Answer {
    pub fn decrypt(&self, _secret: SecretKey) -> ClearAnswer {
        todo! {}
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClearAnswer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub answer: ClearAnswerBody,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClearAnswerBody {
    Open(String),
    Closed(bool),
    Poll(u8),
}

pub mod events;
pub mod state;

pub type AnsweringTransaction = Transaction<QuestionID, MaskID, AnswerID, AnsweringEvent>;
pub type AnsweringSignedTransaction =
    SignedTransaction<QuestionID, MaskID, AnswerID, AnsweringEvent>;
pub type AnsweringRawBlock = Block<QuestionID, MaskID, AnswerID, AnsweringEvent>;
pub type AnsweringBlock = SignedBlock<QuestionID, MaskID, AnswerID, AnsweringEvent>;
