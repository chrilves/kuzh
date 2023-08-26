use crate::{
    common::IdentityID,
    crypto::{PublicKey, RingSig, Sig, SecretKey},
    newtypes::AnswerID,
};

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
    pub fn decrypt(&self, secret: SecretKey) -> ClearAnswers {
        todo!{}
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClearAnswer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub answer: ClearAnswerBody
}


#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClearAnswerBody {
    Open(String),
    Closed(bool),
    Poll(u8)
}

pub mod events;
pub mod state;