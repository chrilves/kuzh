use crate::answering::Answer;
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
    ChangeIdentityInfo {
        identity: RoomIdentityID,
        name: Option<String>,
        description: Option<String>,
    },

    // Room
    RoomAccessibility(RoomAccessibility),
    MaxConnectedUsers(u16),

    // Questions
    Question {
        kind: QuestionKind,
        question: String,
    },
    ClarifyQuestion {
        id: QuestionID,
        clarification: String,
    },
    LikeQuestion {
        id: QuestionID,
        like: Option<Like>,
    },
    OrderQuestion {
        question: QuestionID,
        position: QuestionPosition,
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

    // Messages
    Message(String),
    MessageRights(Role),
    ExplicitMessageRight {
        identity: RoomIdentityID,
        allow: Option<bool>,
    },
}

pub enum QuestionPosition {
    Before(QuestionID),
    After(QuestionID),
    Top,
    Bottom,
}

pub enum QuestionDeleteSpec {
    All,
    Before(QuestionID),
    After(QuestionID),
    Questions(Vec<QuestionID>),
}
