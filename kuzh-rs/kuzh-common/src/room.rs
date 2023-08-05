use std::collections::BinaryHeap;
use std::collections::HashMap;
use std::collections::HashSet;

use crate::answering::Answer;
use crate::common::*;
use crate::crypto::*;
use crate::newtypes::*;

pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

pub struct IdentityInfo {
    pub crypto_id: CryptoID,
    pub name: Option<String>,
    pub description: Option<String>,
    pub nonce: Nonce,
}

pub enum Like {
    Like,
    Dislike,
}

pub struct QuestionInfo {
    pub question: Question,
    pub base_score: i64,
    pub likes: HashMap<UserID, Like>,
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

pub struct IdentitiesState<A> {
    pub identities: Vec<IdentityInfo>,
    pub next_id: Option<A>,
}

pub struct QuestionsState {
    pub limit: u8,
    pub next_id: Option<QuestionID>,
    pub questions: BinaryHeap<QuestionInfo>,
    pub rights: RoomPublicationRights,
}

pub struct RoomState {
    pub block_height: u64,
    pub block_hash: Hashed,
    pub room: IdentityInfo,
    pub users: IdentitiesState<UserID>,
    pub masks: IdentitiesState<MaskID>,
    pub room_accessibility: RoomAccessibility,
    pub max_connected_users: u16,
    pub connected: HashSet<UserID>,
    pub questions_state: QuestionsState,
    pub message_rights: RoomPublicationRights,
    pub answering: Option<QuestionID>,
}
