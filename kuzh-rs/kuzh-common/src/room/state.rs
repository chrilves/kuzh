use crate::common::IdentityID;
use crate::common::Question;
use crate::common::Role;
use crate::common::RoomIdentityID;
use crate::common::RoomPublicationRights;
use crate::crypto::PublicKey;
use crate::crypto::PublicKeyType;
use crate::newtypes::QuestionID;
use crate::room::events::QuestionDeleteSpec;
use crate::room::events::QuestionPriority;
use crate::room::has_identity_info::HasIdentityInfo;

use super::events::RoomEvent;
use super::IdentityInfo;
use super::Like;
use super::RoomAccessibility;
use crate::newtypes::*;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::collections::HashSet;

pub struct RoomState {
    pub block_height: BlockHeight<RoomEvent>,
    pub block_hash: Hashed,
    pub room: IdentityInfo,
    pub users: IdentitiesState<UserID>,
    pub masks: IdentitiesState<MaskID>,
    pub public_key_index: HashMap<PublicKey, (PublicKeyType, RoomIdentityID)>,
    pub room_accessibility: RoomAccessibility,
    pub max_connected_users: u16,
    pub questions_state: QuestionsState,
    pub message_rights: RoomPublicationRights,
    pub answering: Option<QuestionID>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuestionInfo {
    pub question: Question,
    pub likes: HashMap<UserID, Like>,
    pub priority: QuestionPriority,
}

impl QuestionInfo {
    pub fn like_score(&self) -> i32 {
        let mut r = 0i32;
        for l in self.likes.values() {
            use self::Like::*;
            match l {
                Like => r += 1,
                Dislike => r -= 1,
            }
        }
        r
    }
}

impl PartialOrd for QuestionInfo {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QuestionInfo {
    fn cmp(&self, other: &Self) -> Ordering {
        use Ordering::*;
        match self.priority.cmp(&other.priority) {
            Equal => match self.like_score().cmp(&other.like_score()) {
                Equal => self.question.id.cmp(&other.question.id),
                x => x,
            },
            x => x,
        }
    }
}

pub struct IdentitiesState<A> {
    pub identities: Vec<IdentityInfo>,
    pub next_id: Option<A>,
}

pub struct QuestionsState {
    pub max_questions: u8,
    pub next_id: Option<QuestionID>,
    pub questions: HashMap<QuestionID, QuestionInfo>,
    pub rights: RoomPublicationRights,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoomError {
    RoomAlreadyCreated,
    PublicKeyAlreadyUsed,
    MaxUserIDReached,
    MaxMaskIDReached,
    AlreadyConnected,
    NotConnected,
    Unauthorized,
    NoSuchUser,
    NoSuchMask,
    NoSuchIdentity,
    MaxQuestionsReached,
    MaxQuestionIDReached,
    NoSuchQuestion,
    NoAnswering,
    AnsweringAlreadyCreated,
    AnsweringUnjoinable,
    InvalidRole,
    AlreadyJoined,
    InvalidAnsweringPhase,
    ConnectionRefused,
}

pub enum RoomOutput {
    NewQuestion(Question),
    Ban(UserID),
}

#[derive(PartialEq, Eq, Copy, Clone, Debug)]
struct RoleUser(Role, UserID);

impl std::cmp::PartialOrd for RoleUser {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        use Role::*;

        if self == other {
            return Some(Ordering::Equal);
        }

        match (self.0, other.0) {
            (Admin, Admin) => Some(self.1.cmp(&other.1)),
            (Admin, _) => Some(Ordering::Less),
            (_, Admin) => Some(Ordering::Greater),
            (Moderator, Moderator) => None,
            (Moderator, _) => Some(Ordering::Less),
            (_, Moderator) => Some(Ordering::Greater),
            (_, _) => None,
        }
    }
}

impl RoomState {
    pub fn is_valid_user_id(&self, user_id: UserID) -> bool {
        match self.users.next_id {
            Some(n) => user_id < n,
            None => true,
        }
    }

    pub fn is_valid_mask_id(&self, mask_id: MaskID) -> bool {
        match self.masks.next_id {
            Some(n) => mask_id < n,
            None => true,
        }
    }

    pub fn is_valid_identity_id(&self, id: RoomIdentityID) -> bool {
        use IdentityID::*;
        match id {
            RoomID => true,
            User(id) => self.is_valid_user_id(id),
            Mask(id) => self.is_valid_mask_id(id),
        }
    }

    pub fn apply_event(
        &mut self,
        from: RoomIdentityID,
        event: RoomEvent,
    ) -> Result<Option<RoomOutput>, RoomError> {
        use RoomError::*;
        use RoomEvent::*;
        match event {
            RoomCreation { .. } => Err(RoomAlreadyCreated),
            NewUser(id) => {
                if from != RoomIdentityID::RoomID {
                    return Err(Unauthorized);
                }
                if self.public_key_index.contains_key(&id.sign_key)
                    || self.public_key_index.contains_key(&id.encrypt_key.value)
                {
                    return Err(PublicKeyAlreadyUsed);
                }
                match self.users.next_id {
                    Some(n) => {
                        self.public_key_index
                            .insert(id.sign_key, (PublicKeyType::Sign, RoomIdentityID::User(n)));
                        self.public_key_index.insert(
                            id.encrypt_key.value,
                            (PublicKeyType::Encrypt, RoomIdentityID::User(n)),
                        );
                        self.users.identities.push(IdentityInfo {
                            crypto_id: *id,
                            name: None,
                            description: None,
                            nonce: Nonce::new(),
                            role: Role::Regular,
                        });
                        self.users.next_id = n.next();
                        Ok(None)
                    }
                    None => Err(MaxUserIDReached),
                }
            }
            NewMask(id) => {
                if from != RoomIdentityID::RoomID {
                    return Err(Unauthorized);
                }

                if self.public_key_index.contains_key(&id.sign_key)
                    || self.public_key_index.contains_key(&id.encrypt_key.value)
                {
                    return Err(PublicKeyAlreadyUsed);
                }
                match self.masks.next_id {
                    Some(n) => {
                        self.public_key_index
                            .insert(id.sign_key, (PublicKeyType::Sign, RoomIdentityID::Mask(n)));
                        self.public_key_index.insert(
                            id.encrypt_key.value,
                            (PublicKeyType::Encrypt, RoomIdentityID::Mask(n)),
                        );
                        self.masks.identities.push(IdentityInfo {
                            crypto_id: *id,
                            name: None,
                            description: None,
                            nonce: Nonce::new(),
                            role: Role::Regular,
                        });
                        self.masks.next_id = n.next();
                        Ok(None)
                    }
                    None => Err(MaxMaskIDReached),
                }
            }
            ChangeRole { user, role } => {
                use IdentityID::*;
                use Role::*;

                let user_role = user.role(self)?;

                match from {
                    User(from_user) => {
                        let from_role = from_user.role(self)?;

                        if !RoleUser(from_role, from_user).le(&RoleUser(user_role, user)) {
                            return Err(Unauthorized);
                        }

                        if (role == Admin || role == Moderator) && from_role != Admin {
                            return Err(Unauthorized);
                        }
                    }
                    RoomID => (),
                    Mask(_) => return Err(Unauthorized),
                };

                self.users.identities[usize::from(user)].role = role;
                Ok(if role == Banned {
                    Some(RoomOutput::Ban(user))
                } else {
                    None
                })
            }
            ChangeIdentityInfo(id_info) => {
                if !self.is_valid_identity_id(id_info.identity) {
                    return Err(NoSuchIdentity);
                }

                use IdentityID::*;
                use Role::*;

                if id_info.identity == RoomID && from != RoomID {
                    let from_role = from.role(self)?;
                    if from_role != Admin {
                        return Err(Unauthorized);
                    }
                } else if id_info.identity != from || from.role(self)? == Banned {
                    return Err(Unauthorized);
                }

                let from_info = from.identity_info_mut(self)?;

                if id_info.name.is_some() {
                    from_info.name = id_info.name;
                }
                if id_info.description.is_some() {
                    from_info.description = id_info.description;
                }

                Ok(None)
            }
            // Room
            ChangeRoomAccessibility(mut a) => {
                from.ensure_admin_or_moderator(self)?;
                std::mem::swap(&mut a, &mut self.room_accessibility);
                Ok(None)
            }
            MaxConnectedUsers(mut c) => {
                from.ensure_admin_or_moderator(self)?;
                std::mem::swap(&mut c, &mut self.max_connected_users);
                Ok(None)
            }
            // Questions
            NewQuestion { kind, question } => {
                match self.questions_state.rights.explicit.get(&from) {
                    Some(false) | None if from.role(self)? > self.questions_state.rights.role => {
                        return Err(Unauthorized)
                    }
                    _ => (),
                }
                if self.questions_state.questions.len()
                    >= self.questions_state.max_questions as usize
                {
                    return Err(MaxQuestionsReached);
                }
                match self.questions_state.next_id {
                    Some(n) => {
                        self.questions_state.questions.insert(
                            n,
                            QuestionInfo {
                                question: Question {
                                    id: n,
                                    from,
                                    kind,
                                    question,
                                    clarifications: Vec::new(),
                                },
                                likes: HashMap::new(),
                                priority: QuestionPriority::Standard,
                            },
                        );
                        self.questions_state.next_id = n.next();
                        Ok(None)
                    }
                    None => Err(MaxQuestionIDReached),
                }
            }
            ClarifyQuestion {
                question,
                clarification,
            } => {
                let role = from.role(self)?;

                let q = &mut self
                    .questions_state
                    .questions
                    .get_mut(&question)
                    .ok_or(NoSuchQuestion)?
                    .question;
                use Role::*;
                if role != Banned && (q.from == from || role == Admin || role == Moderator) {
                    return Err(Unauthorized);
                }
                q.clarifications.push(clarification);
                Ok(None)
            }
            LikeQuestion { question, like } => {
                use IdentityID::*;
                let user_id = match from {
                    User(id) => id,
                    _ => return Err(Unauthorized),
                };

                if user_id.role(self)? == Role::Banned {
                    return Err(RoomError::Unauthorized);
                }

                match self.questions_state.questions.get_mut(&question) {
                    Some(q) => {
                        match like {
                            Some(l) => {
                                q.likes.insert(user_id, l);
                            }
                            None => {
                                q.likes.remove(&user_id);
                            }
                        }
                        Ok(None)
                    }
                    None => Err(NoSuchQuestion),
                }
            }
            ChangeQuestionPriority {
                question,
                mut priority,
            } => {
                from.ensure_admin_or_moderator(self)?;
                let q = &mut self
                    .questions_state
                    .questions
                    .get_mut(&question)
                    .ok_or(NoSuchQuestion)?;
                std::mem::swap(&mut priority, &mut q.priority);
                Ok(None)
            }
            DeleteQuestions(spec) => {
                from.ensure_admin_or_moderator(self)?;

                let mut deleted = Vec::new();

                let check_exist = |qs: &[QuestionID]| {
                    if qs
                        .iter()
                        .all(|id| self.questions_state.questions.contains_key(id))
                    {
                        Ok(())
                    } else {
                        Err(NoSuchQuestion)
                    }
                };

                use QuestionDeleteSpec::*;
                let to_delete = match spec {
                    Delete(qs) => {
                        check_exist(&qs)?;
                        qs
                    }
                    Keep(qs) => {
                        check_exist(&qs)?;
                        let qs_set: HashSet<QuestionID> = qs.into_iter().collect();
                        self.questions_state
                            .questions
                            .keys()
                            .filter(|k| qs_set.contains(k))
                            .copied()
                            .collect()
                    }
                    DeletePriority(p) => self
                        .questions_state
                        .questions
                        .values()
                        .filter(|v| v.priority < p)
                        .map(|v| v.question.id)
                        .collect(),
                };

                for id in &to_delete {
                    if let Some(q) = self.questions_state.questions.remove(id) {
                        deleted.push(q);
                    }
                }
                Ok(None)
            }
            // Question Rights
            MaxQuestions(mut m) => {
                from.ensure_admin_or_moderator(self)?;
                std::mem::swap(&mut m, &mut self.questions_state.max_questions);
                Ok(None)
            }
            QuestionRights(mut r) => {
                from.ensure_admin_or_moderator(self)?;
                if r == Role::Banned {
                    return Err(InvalidRole);
                }

                std::mem::swap(&mut r, &mut self.questions_state.rights.role);
                Ok(None)
            }
            ExplicitQuestionRight { identity, allow } => {
                from.ensure_admin_or_moderator(self)?;
                if !self.is_valid_identity_id(identity) {
                    return Err(NoSuchIdentity);
                }
                self.questions_state.rights.explicit.remove(&identity);
                if let Some(r) = allow {
                    self.questions_state.rights.explicit.insert(identity, r);
                }
                Ok(None)
            }
            // Answering
            OpenAnswering => {
                from.ensure_admin_or_moderator(self)?;

                let mut min: Option<&QuestionInfo> = None;

                for v in self.questions_state.questions.values() {
                    match min {
                        Some(m) => {
                            if *m < *v {
                                min = Some(m)
                            }
                        }
                        None => min = Some(v),
                    }
                }

                Ok(min.map(|m| m.question.id).and_then(|id| {
                    self.questions_state
                        .questions
                        .remove(&id)
                        .map(|q| RoomOutput::NewQuestion(q.question))
                }))
            }
            CloseAnswering => {
                from.ensure_admin_or_moderator(self)?;
                if self.answering.is_some() {
                    self.answering = None;
                    Ok(None)
                } else {
                    Err(NoAnswering)
                }
            }
            FinishedAnswering => {
                if !(from == IdentityID::RoomID) {
                    return Err(Unauthorized);
                }
                if self.answering.is_some() {
                    self.answering = None;
                    Ok(None)
                } else {
                    Err(NoAnswering)
                }
            }
            // Messages
            Message(_) => match self.message_rights.explicit.get(&from) {
                Some(true) => Ok(None),
                Some(false) => Err(Unauthorized),
                None => {
                    if from.role(self)? <= self.message_rights.role {
                        Ok(None)
                    } else {
                        Err(Unauthorized)
                    }
                }
            },
            MessageRights(mut r) => {
                from.ensure_admin_or_moderator(self)?;
                if r == Role::Banned {
                    return Err(InvalidRole);
                }
                std::mem::swap(&mut r, &mut self.message_rights.role);
                Ok(None)
            }
            ExplicitMessageRight { identity, allow } => {
                from.ensure_admin_or_moderator(self)?;
                if !self.is_valid_identity_id(identity) {
                    return Err(NoSuchIdentity);
                }
                self.message_rights.explicit.remove(&identity);
                if let Some(r) = allow {
                    self.message_rights.explicit.insert(identity, r);
                }
                Ok(None)
            }
        }
    }
}
