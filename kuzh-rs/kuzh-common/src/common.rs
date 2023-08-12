use crate::newtypes::*;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum IdentityID<MaskID> {
    RoomID,
    User(UserID),
    Mask(MaskID),
}

pub type NodeIdentity = IdentityID<!>;
pub type RoomIdentityID = IdentityID<MaskID>;
pub type AnsweringIdentityID = IdentityID<AnswerID>;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum QuestionKind {
    Closed,
    Open,
    Poll(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
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
