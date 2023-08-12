use crate::common::Question;
use crate::common::RoomPublicationRights;
use crate::newtypes::QuestionID;

use super::events::RoomEvent;
use super::IdentityInfo;
use super::Like;
use super::RoomAccessibility;
use std::collections::BinaryHeap;
use std::collections::HashMap;
use std::collections::HashSet;

use crate::newtypes::*;

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

pub struct QuestionInfo {
    pub question: Question,
    pub base_score: i64,
    pub likes: HashMap<UserID, Like>,
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

pub enum RoomError {
    RoomCreationAfterInit,
}

impl RoomState {
    pub fn event(&mut self, event: RoomEvent) -> Result<RoomAntiEvent, RoomError> {
        use RoomEvent::*;
        match event {
            RoomCreation => Err(RoomError::RoomCreationAfterInit),
            NewUser(id) => {}
            NewMask(id) => {}
            Connected(id) => {}
            Disconnected(id) => {}
            ChangeRole { user, role } => {}
            ChangeIdentityInfo {
                identity,
                name,
                description,
            } => {}
            // Room
            RoomAccessibility(a) => {}
            MaxConnectedUsers(c) => {}
            // Questions
            Question { kind, question } => {}
            ClarifyQuestion { id, clarification } => {}
            LikeQuestion { id, like } => {}
            OrderQuestion { question, position } => {}
            DeleteQuestions(spec) => {}
            // Question Rights
            MaxQuestions(m) => {}
            QuestionRights(r) => {}
            ExplicitQuestionRight { identity, allow } => {}
            // Answering
            OpenAnswering => {}
            CloseAnswering => {}
            FinishedAnswering => {}

            CheaterWrongCommitment {
                context,
                user,
                encryptio,
                secret,
            } => {}
            CheaterTwoAnswers {
                context,
                user,
                answer_1,
                answer_2,
            } => {}
            // Messages
            Message(m) => {}
            MessageRights(r) => {}
            ExplicitMessageRight { identity, allow } => {}
        }
    }
}
