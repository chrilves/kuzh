use crate::common::*;
use crate::crypto::*;
use crate::newtypes::*;

use super::Like;
use super::RoomAccessibility;

pub enum RoomEvent {
    // Identities
    RoomCreation {
        room: Box<CryptoID>,
        first_admin: Box<CryptoID>,
    },
    NewUser(Box<CryptoID>),
    NewMask(Box<CryptoID>),
    Connected(UserID),
    Disconnected(UserID),
    ChangeRole {
        user: UserID,
        role: Role,
    },
    ChangeIdentityInfo(ChangeIdentityInfo),

    // Room
    ChangeRoomAccessibility(RoomAccessibility),
    MaxConnectedUsers(u16),

    // Questions
    NewQuestion {
        kind: QuestionKind,
        question: String,
    },
    ClarifyQuestion {
        question: QuestionID,
        clarification: String,
    },
    LikeQuestion {
        question: QuestionID,
        like: Option<Like>,
    },
    ChangeQuestionPriority {
        question: QuestionID,
        priority: QuestionPriority,
    },
    DeleteQuestions(QuestionDeleteSpec),

    // Question Rights
    MaxQuestions(u8),
    QuestionRights(Role),
    ExplicitQuestionRight {
        identity: RoomIdentityID,
        allow: Option<bool>,
    },

    // Answering
    OpenAnswering,
    CloseAnswering,
    FinishedAnswering,

    /*
    CheaterWrongCommitment {
        context: Box<[u8]>,
        user: UserID,
        encryption: Box<(PublicKey, Sig)>,
        secret: Box<(SecretKey, Sig)>,
    },
    CheaterTwoAnswers {
        context: Box<[u8]>,
        user: UserID,
        answer_1: Box<Answer>,
        answer_2: Box<Answer>,
    },
    */
    // Messages
    Message(String),
    MessageRights(Role),
    ExplicitMessageRight {
        identity: RoomIdentityID,
        allow: Option<bool>,
    },
}

#[derive(Debug)]
pub struct ChangeIdentityInfo {
    pub identity: RoomIdentityID,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum QuestionPriority {
    Bottom,
    Low,
    Standard,
    Hight,
    Top,
}

impl PartialOrd for QuestionPriority {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QuestionPriority {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        fn to_u8(p: &QuestionPriority) -> u8 {
            use QuestionPriority::*;
            match p {
                Bottom => 0,
                Low => 1,
                Standard => 2,
                Hight => 3,
                Top => 4,
            }
        }

        to_u8(self).cmp(&to_u8(other))
    }
}

pub enum QuestionDeleteSpec {
    Delete(Vec<QuestionID>),
    Keep(Vec<QuestionID>),
    DeletePriority(QuestionPriority),
}
