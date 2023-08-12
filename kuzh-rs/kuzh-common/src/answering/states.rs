use std::collections::{HashMap, HashSet};

use crate::common::AnsweringIdentityID;
use crate::common::Question;
use crate::crypto::{PublicKey, SecretKey};
use crate::newtypes::UserID;

use super::events::AnsweringEvent;
use super::Answer;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnsweringState {
    pub question: Question,
    pub members: AnsweringMembers,
}

#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserOpenState {
    pub encryption_share: Option<PublicKey>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserAnswersState {
    pub encryption_share: PublicKey,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserDecryptState {
    pub encryption_share: PublicKey,
    pub secret_share: Option<SecretKey>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ClearAnswers {
    Cloded(Vec<bool>),
    Open(Vec<String>),
}

type CancelAsnweringStateChange = Box<dyn FnMut(&mut AnsweringState)>;

impl AnsweringState {
    pub fn event(
        &mut self,
        from: AnsweringIdentityID,
        event: AnsweringEvent,
    ) -> Result<CancelAsnweringStateChange, String> {
        Ok(Box::new(|state| ()))
    }
}
