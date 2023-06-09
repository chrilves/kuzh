use std::collections::BinaryHeap;
use std::collections::HashMap;
use std::collections::HashSet;

use crate::answering::Answer;
use crate::answering::AnsweringState;
use crate::common::*;
use crate::crypto::*;
use crate::gate::*;

pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(PublicKey),
}

pub struct ID {
    dsa_public_key: PublicKey,
    dh_public_key: PublicKey,
}

pub enum Role {
    Room,
    Admin,
    Moderator,
    User,
    Banned,
}

pub struct UserInfo {
    id: ID,
    nonce: Nonce,
    name: String,
}

pub enum Like {
    Like,
    Dislike,
}

pub struct QuestionInfo {
    question: Question,
    base_score: i16,
    likes: HashMap<User, Like>,
}

pub enum RoomEvent {
    // Server Events
    NewUser(ID),
    Connected(User),
    Disconnected(User),
    Question {
        kind: QuestionKind,
        question: String,
    },
    AnonMessage {
        rnd: u64,
        msg: String,
    },
    FinishedAnswering,
    CheaterWrongCommitment {
        context: Box<[u8]>,
        user: User,
        encryption: (PublicKey, Sig),
        secret: (SecretKey, Sig),
    },
    CheaterTwoAnswers {
        context: Box<[u8]>,
        user: User,
        answer_1: Answer,
        answer_2: Answer,
    },

    // User events
    UpdateNonce(Nonce),
    ChangeUserName(String), // You can only change your name
    Message(String),
    LikeQuestion {
        id: QuestionID,
        like: Option<Like>,
    },

    // Admin/Moderator Events
    ChangeRoomName(String),
    ChangeRoomAccessibility(RoomAccessibility),
    ChangeRole {
        id: User,
        role: Role,
    },
    DeleteQuestion(QuestionID),
    TopQuestion(QuestionID),
    OpenAnswering,
    CloseAnswering,
}

pub struct RoomState {
    users: Vec<UserInfo>,
    connected: HashSet<User>,
    questions: BinaryHeap<QuestionInfo>,
    next_question_id: QuestionID,
    messages: Vec<Message>,
    answering: Option<AnsweringState>,
}
