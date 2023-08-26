use crate::newtypes::*;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum IdentityID<MaskID> {
    RoomID,
    User(UserID),
    Mask(MaskID),
}

impl<A> IdentityID<A> {
    #[inline(always)]
    pub fn user_id(&self) -> Option<UserID> {
        match self {
            IdentityID::User(id) => Some(*id),
            _ => None,
        }
    }
}

pub type NodeIdentity = IdentityID<!>;
pub type RoomIdentityID = IdentityID<MaskID>;
pub type AnsweringIdentityID = IdentityID<AnswerID>;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum QuestionKind {
    Open,
    Closed,
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

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq)]
pub enum Role {
    Admin,
    Moderator,
    Regular,
    Banned,
}

impl Role {
    #[inline(always)]
    pub const fn is_admin_or_moderator(self) -> bool {
        use Role::*;
        matches!(self, Admin | Moderator)
    }

    #[inline(always)]
    pub const fn is_not_banned(self) -> bool {
        !matches!(self, Role::Banned)
    }
}

impl PartialOrd for Role {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Role {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        fn value(r: Role) -> u8 {
            use Role::*;
            match r {
                Admin => 0,
                Moderator => 1,
                Regular => 2,
                Banned => 3,
            }
        }

        value(*self).cmp(&value(*other))
    }
}

pub struct PublicationRights<MaskID> {
    pub role: Role,
    pub explicit: HashMap<IdentityID<MaskID>, bool>,
}

pub type RoomPublicationRights = PublicationRights<MaskID>;
pub type AnsweringPublicationRights = PublicationRights<AnswerID>;
