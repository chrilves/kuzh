use crate::crypto::*;
use crate::{common::Role, newtypes::*};

use super::{Answer, AnsweringIdentityID};

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
    Ready(Box<PublicKey>),
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
