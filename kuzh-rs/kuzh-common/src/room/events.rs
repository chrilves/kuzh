use never_type::Never;

use crate::common::*;
use crate::crypto::*;

use super::state::RoomError;
use super::Like;
use super::RoomAccessibility;

pub enum RoomEvent {
    // Identities
    RoomCreation(Box<CryptoID>),
    NewUser(Box<CryptoID>),
    NewMask(Box<CryptoID>),
    ChangeRole {
        user: UserID,
        role: Role,
    },
    ChangeName {
        identity: RoomIdentityID,
        name: Option<String>
    },
    ChangeDescription {
        identity: RoomIdentityID,
        description: Option<String>
    },

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
    DeleteQuestion(QuestionID),
    DeleteQuestionPriority(QuestionPriority),

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

pub type RoomTransaction = Transaction<(), MaskID, Never, RoomEvent>;
pub type SignedRoomTransaction = SignedTransaction<(), MaskID, Never, RoomEvent>;
pub type RoomBlock = Block<(), MaskID, Never, RoomEvent>;
pub type RoomSignedBlock = SignedBlock<(), MaskID, Never, RoomEvent>;

trait RoomState {
}

trait Transact<State>: RoomState {
    async fn apply_event(&mut self, from: RoomIdentityID, event: &RoomEvent) -> Option<RoomError>;
    async fn revert(self) -> State;
    async fn commit(self) -> State;
}

trait Transactable: RoomState {
    type Transact;
    async fn patch(self) -> impl Transact<Self>;
}