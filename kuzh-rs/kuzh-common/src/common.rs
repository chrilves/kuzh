use crate::newtypes::*;
use std::collections::HashMap;

pub enum IdentityID<MaskID> {
    RoomID,
    User(UserID),
    Mask(MaskID),
}

pub type RoomIdentityID = IdentityID<MaskID>;
pub type AnsweringIdentityID = IdentityID<AnswerID>;

pub enum QuestionKind {
    Open,
    Closed,
}

pub struct Question {
    pub id: QuestionID,
    pub from: RoomIdentityID,
    pub kind: QuestionKind,
    pub question: String,
    pub clarifications: Vec<String>,
}

pub enum Role {
    Admin,
    Moderator,
    Regular,
    Banned,
}

pub struct PublicationRights<MaskID> {
    pub role: Role,
    pub explicit: HashMap<IdentityID<MaskID>, bool>,
}

pub type RoomPublicationRights = PublicationRights<MaskID>;
pub type AnsweringPublicationRights = PublicationRights<AnswerID>;
