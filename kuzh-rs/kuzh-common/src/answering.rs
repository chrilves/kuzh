use std::collections::{HashMap, HashSet};

use crate::crypto::*;
use crate::{
    common::{Question, Role},
    newtypes::*,
};

pub const ANSWER_SIZE: usize = 300;

pub struct Answer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub answer: [u8; ANSWER_SIZE],
    pub ring_sig: RingSig,
    pub sig: Sig,
}

pub enum AnsweringIdentityID {
    Room,
    User(UserID),
    Mask(AnswerID),
}

pub enum AnsweringEvent {
    // User Management
    LostUser(UserID),
    Leave,
    Kick {
        user: UserID,
    },

    // Admin Management
    HurryUp,
    Collect,

    // Anonymous Protocol
    Ready(PublicKey),
    Answer(Answer),
    SecretShare(SecretKey),

    // Messages
    Message(String),
    MessageRights(Role),
    ExplicitMessageRight {
        identity: AnsweringIdentityID,
        allow: Option<bool>,
    },
}

pub struct UserOpenState {
    pub encryption_share: Option<PublicKey>,
}

pub struct UserAnswersState {
    pub encryption_share: PublicKey,
}

pub struct UserDecryptState {
    pub encryption_share: PublicKey,
    pub secret_share: Option<SecretKey>,
}

pub enum ClearAnswers {
    Cloded(Vec<bool>),
    Open(Vec<String>),
}

pub enum AnsweringMembers {
    Open {
        members: HashMap<UserID, UserOpenState>,
        gone: HashSet<UserID>,
        encryption_key: PublicKey,
    },
    Answers {
        members: HashMap<UserID, UserAnswersState>,
        encryption_key: PublicKey,
        answers: Vec<Answer>,
    },
    Decrypt {
        members: HashMap<UserID, UserDecryptState>,
        encryption_key: PublicKey,
        secret_key: SecretKey,
        answers: Vec<Answer>,
    },
    Debate {
        members: HashSet<UserID>,
        answers: ClearAnswers,
    },
}

pub struct AnsweringState {
    pub question: Question,
    pub members: AnsweringMembers,
}
