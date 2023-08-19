use crate::{
    common::IdentityID,
    crypto::{PublicKey, RingSig, Sig},
    newtypes::AnswerID,
};

pub type AnsweringIdentityID = IdentityID<AnswerID>;
pub const ANSWER_SIZE: usize = 300;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub answer: [u8; ANSWER_SIZE],
    pub ring_sig: RingSig,
    pub sig: Sig,
}

pub mod events;
pub mod state;
