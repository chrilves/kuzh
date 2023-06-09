use std::collections::{HashMap, HashSet};

use crate::crypto::*;
use crate::{
    common::{Message, Question},
    gate::*,
};

pub struct Answer {
    encryption_key: PublicKey,
    answer: [u8; 300],
    signature: RingSig,
}

pub enum AnswerEvent {
    // Server Event
    PublishAnswer(Answer),
    AnonMessage { rnd: u64, msg: String },
    LostUser(User),

    // User Events
    Leave, // Only you can leave
    Ready(PublicKey),
    SecretShare(SecretKey),
    Message(String), // Users must be present, admins/modos can always

    // Admin/Moderator Events
    Kick { user: User },
    HurryUp,
    Collect,
}

pub struct UserOpenState {
    encryption_share: Option<PublicKey>,
}

pub struct UserAnswersState {
    encryption_share: PublicKey,
}

pub struct UserDecryptState {
    encryption_share: PublicKey,
    secret_share: Option<SecretKey>,
}

pub enum ClearAnswers {
    Cloded(Vec<bool>),
    Open(Vec<String>),
}

pub enum AnsweringMembers {
    Open {
        members: HashMap<User, UserOpenState>,
        gone: HashSet<User>,
        encryption_key: PublicKey,
    },
    Answers {
        members: HashMap<User, UserAnswersState>,
        encryption_key: PublicKey,
        answers: Vec<Answer>,
    },
    Decrypt {
        members: HashMap<User, UserDecryptState>,
        encryption_key: PublicKey,
        secret_key: SecretKey,
        answers: Vec<Answer>,
    },
    Debate {
        members: HashSet<User>,
        answers: ClearAnswers,
    },
}

pub struct AnsweringState {
    question: Question,
    members: AnsweringMembers,
    messages: Vec<Message>,
}
