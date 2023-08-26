use crate::common::Question;
use crate::crypto::*;
use crate::{common::Role, newtypes::*};

use super::{Answer, AnsweringIdentityID};

pub enum AnsweringEvent {
    CreateAnswering(Question),
    // User Management
    Join,
    Leave,
    Connected(UserID),
    Disconnected(UserID),
    Kick(UserID),
    Unkick(UserID),

    // Admin Management
    ChangeJoinability(bool),
    ChangeCollectability(bool),
    Go,

    // Anonymous Protocol
    Ready {
        public_key: Box<PublicKey>,
        challenge: Box<Sig>
    },
    Answer(Box<Answer>),
    SecretShare(Box<SecretKey>),

    // Messages
    Message(String),
    MessageRights(Role),
    ExplicitMessageRight {
        identity: AnsweringIdentityID,
        allow: Option<bool>,
    },
}
