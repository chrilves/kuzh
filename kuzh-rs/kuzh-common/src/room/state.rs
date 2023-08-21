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

use super::events::ChangeIdentityInfo;
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
    pub room: IdentityInfo<()>,
    pub users: IdentitiesState<Role, UserID>,
    pub masks: IdentitiesState<(), MaskID>,
    pub public_key_index: HashMap<PublicKey, (PublicKeyType, RoomIdentityID)>,
    pub room_accessibility: RoomAccessibility,
    pub max_connected_users: u16,
    pub connected: HashSet<UserID>,
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

pub struct IdentitiesState<R, A> {
    pub identities: Vec<IdentityInfo<R>>,
    pub next_id: Option<A>,
}

pub struct QuestionsState {
    pub max_questions: u8,
    pub next_id: Option<QuestionID>,
    pub questions: HashMap<QuestionID, QuestionInfo>,
    pub rights: RoomPublicationRights,
}

#[derive(Debug)]
pub enum RoomStateCancel {
    RemoveNewUser,
    RemoveNewMask,
    Connect(UserID),
    Disconnect(UserID),
    RestoreRole {
        user: UserID,
        role: Role,
    },
    RestoreIdentityInfo(ChangeIdentityInfo),
    RestoreRoomAccessibility(RoomAccessibility),
    RestoreMaxConnectedUsers(u16),
    RemoveNewQuestion,
    RemoveQuestionClarification(QuestionID),
    RestoreLikeQuestion {
        from: UserID,
        question: QuestionID,
        like: Option<Like>,
    },
    RestoreQuestionPriority {
        question: QuestionID,
        priority: QuestionPriority,
    },
    RestoreDeletedQuestions(Vec<QuestionInfo>),
    RestoreMaxQuestions(u8),
    RestoreQuestionRights(Role),
    RestoreExplicitQuestionRights {
        identity: RoomIdentityID,
        allow: Option<bool>,
    },
    CancelOpenAnswering(QuestionInfo),
    ReopenAnswering(QuestionID),
    RestoreMessageRights(Role),
    RestoreExplicitMessageRights {
        identity: RoomIdentityID,
        allow: Option<bool>,
    },
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
    NoSuchIdentity,
    MaxQuestionsReached,
    MaxQuestionIDReached,
    NoSuchQuestion,
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
    pub fn valid_user_id(&self, user_id: UserID) -> bool {
        match self.users.next_id {
            Some(n) => user_id < n,
            None => true,
        }
    }

    pub fn valid_mask_id(&self, mask_id: MaskID) -> bool {
        match self.masks.next_id {
            Some(n) => mask_id < n,
            None => true,
        }
    }

    pub fn valid_identity_id(&self, id: RoomIdentityID) -> bool {
        use IdentityID::*;
        match id {
            RoomID => true,
            User(id) => self.valid_user_id(id),
            Mask(id) => self.valid_mask_id(id),
        }
    }

    pub fn role(&self, id: UserID) -> Result<Role, RoomError> {
        match self.users.identities.get::<usize>(id.into()) {
            Some(u) => Ok(u.role),
            None => Err(RoomError::NoSuchUser),
        }
    }

    pub fn identity_role(&self, id: RoomIdentityID) -> Result<Role, RoomError> {
        use IdentityID::*;
        use Role::*;
        match id {
            RoomID => Ok(Admin),
            User(uid) => self.role(uid),
            Mask(_) => Ok(Regular),
        }
    }

    #[inline]
    pub fn ensure_admin_or_moderator(&self, from: RoomIdentityID) -> Result<(), RoomError> {
        use Role::*;
        match self.identity_role(from)? {
            Admin | Moderator => Ok(()),
            _ => Err(RoomError::Unauthorized),
        }
    }

    pub fn update(
        &mut self,
        from: RoomIdentityID,
        event: RoomEvent,
    ) -> Result<Option<RoomStateCancel>, RoomError> {
        use RoomError::*;
        use RoomEvent::*;
        use RoomStateCancel::*;
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
                        Ok(Some(RemoveNewUser))
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
                            role: (),
                        });
                        self.masks.next_id = n.next();
                        Ok(Some(RemoveNewMask))
                    }
                    None => Err(MaxMaskIDReached),
                }
            }
            Connected(id) => {
                if from != RoomIdentityID::RoomID {
                    return Err(Unauthorized);
                }
                if !self.valid_user_id(id) {
                    return Err(NoSuchUser);
                }
                if self.connected.contains(&id) {
                    return Err(AlreadyConnected);
                }
                Ok(if self.connected.contains(&id) {
                    None
                } else {
                    self.connected.insert(id);
                    Some(Disconnect(id))
                })
            }
            Disconnected(id) => {
                if from != RoomIdentityID::RoomID {
                    return Err(Unauthorized);
                }
                if !self.valid_user_id(id) {
                    return Err(NoSuchUser);
                }
                if !self.connected.contains(&id) {
                    return Err(NotConnected);
                }
                Ok(if self.connected.contains(&id) {
                    self.connected.remove(&id);
                    Some(Connect(id))
                } else {
                    None
                })
            }
            ChangeRole { user, role } => {
                use IdentityID::*;
                use Role::*;

                let user_role = self.role(user)?;

                match from {
                    User(from_user) => {
                        let from_role = self.role(from_user)?;

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
                Ok(Some(RestoreRole {
                    user,
                    role: user_role,
                }))
            }
            ChangeIdentityInfo(id_info) => {
                if !self.valid_identity_id(id_info.identity) {
                    return Err(NoSuchIdentity);
                }

                use IdentityID::*;
                use Role::*;

                if id_info.identity == RoomID && from != RoomID {
                    let from_role = self.identity_role(from)?;
                    if from_role != Admin {
                        return Err(Unauthorized);
                    }
                }

                if id_info.identity != from {
                    return Err(Unauthorized);
                }

                fn doit<A>(
                    mut id_info: self::ChangeIdentityInfo,
                    i: &mut IdentityInfo<A>,
                ) -> Result<Option<RoomStateCancel>, RoomError> {
                    if id_info.name.is_some() {
                        std::mem::swap(&mut id_info.name, &mut i.name);
                    }
                    if id_info.description.is_some() {
                        std::mem::swap(&mut id_info.description, &mut i.description);
                    }

                    Ok(Some(RoomStateCancel::RestoreIdentityInfo(id_info)))
                }

                match id_info.identity {
                    RoomID => doit(id_info, &mut self.room),
                    User(id) => doit(id_info, &mut self.users.identities[usize::from(id)]),
                    Mask(id) => doit(id_info, &mut self.masks.identities[usize::from(id)]),
                }
            }
            // Room
            ChangeRoomAccessibility(mut a) => {
                self.ensure_admin_or_moderator(from)?;
                std::mem::swap(&mut a, &mut self.room_accessibility);
                Ok(Some(RestoreRoomAccessibility(a)))
            }
            MaxConnectedUsers(mut c) => {
                self.ensure_admin_or_moderator(from)?;
                std::mem::swap(&mut c, &mut self.max_connected_users);
                Ok(Some(RestoreMaxConnectedUsers(c)))
            }
            // Questions
            NewQuestion { kind, question } => {
                match self.questions_state.rights.explicit.get(&from) {
                    Some(false) | None
                        if self.identity_role(from)? > self.questions_state.rights.role =>
                    {
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
                        Ok(Some(RemoveNewQuestion))
                    }
                    None => Err(MaxQuestionIDReached),
                }
            }
            ClarifyQuestion {
                question,
                clarification,
            } => {
                let has_right = self.ensure_admin_or_moderator(from);
                let q = &mut self
                    .questions_state
                    .questions
                    .get_mut(&question)
                    .ok_or(NoSuchQuestion)?
                    .question;
                if q.from != from {
                    has_right?;
                }
                q.clarifications.push(clarification);
                Ok(Some(RemoveQuestionClarification(question)))
            }
            LikeQuestion { question, like } => {
                use IdentityID::*;
                let user_id = match from {
                    User(id) => id,
                    _ => return Err(Unauthorized),
                };

                match self.questions_state.questions.get_mut(&question) {
                    Some(q) => match like {
                        Some(l) => Ok(Some(RestoreLikeQuestion {
                            from: user_id,
                            question,
                            like: q.likes.insert(user_id, l),
                        })),
                        None => Ok(Some(RestoreLikeQuestion {
                            from: user_id,
                            question,
                            like: q.likes.remove(&user_id),
                        })),
                    },
                    None => Err(NoSuchQuestion),
                }
            }
            ChangeQuestionPriority {
                question,
                mut priority,
            } => {
                self.ensure_admin_or_moderator(from)?;
                let q = &mut self
                    .questions_state
                    .questions
                    .get_mut(&question)
                    .ok_or(NoSuchQuestion)?;
                std::mem::swap(&mut priority, &mut q.priority);
                Ok(Some(RestoreQuestionPriority { question, priority }))
            }
            DeleteQuestions(spec) => {
                self.ensure_admin_or_moderator(from)?;

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
                Ok(Some(RestoreDeletedQuestions(deleted)))
            }
            // Question Rights
            MaxQuestions(mut m) => {
                self.ensure_admin_or_moderator(from)?;
                std::mem::swap(&mut m, &mut self.questions_state.max_questions);
                Ok(Some(RestoreMaxQuestions(m)))
            }
            QuestionRights(mut r) => {
                self.ensure_admin_or_moderator(from)?;
                std::mem::swap(&mut r, &mut self.questions_state.rights.role);
                Ok(Some(RestoreQuestionRights(r)))
            }
            ExplicitQuestionRight { identity, allow } => {
                self.ensure_admin_or_moderator(from)?;
                if !self.valid_identity_id(identity) {
                    return Err(NoSuchIdentity);
                }
                let old = self.questions_state.rights.explicit.remove(&identity);
                if let Some(r) = allow {
                    self.questions_state.rights.explicit.insert(identity, r);
                }
                Ok(Some(RestoreExplicitQuestionRights {
                    identity,
                    allow: old,
                }))
            }
            // Answering
            OpenAnswering => {
                self.ensure_admin_or_moderator(from)?;

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
                        .map(CancelOpenAnswering)
                }))
            }
            CloseAnswering => {
                self.ensure_admin_or_moderator(from)?;

                Ok(match self.answering {
                    Some(old) => {
                        self.answering = None;
                        Some(ReopenAnswering(old))
                    }
                    None => None,
                })
            }
            FinishedAnswering => {
                if !(from == IdentityID::RoomID) {
                    return Err(Unauthorized);
                }
                Ok(match self.answering {
                    Some(old) => {
                        self.answering = None;
                        Some(ReopenAnswering(old))
                    }
                    None => None,
                })
            }
            // Messages
            Message(_) => match self.message_rights.explicit.get(&from) {
                Some(true) => Ok(None),
                Some(false) => Err(Unauthorized),
                None => {
                    if self.identity_role(from)? <= self.message_rights.role {
                        Ok(None)
                    } else {
                        Err(Unauthorized)
                    }
                }
            },
            MessageRights(mut r) => {
                self.ensure_admin_or_moderator(from)?;
                std::mem::swap(&mut r, &mut self.message_rights.role);
                Ok(Some(RestoreMessageRights(r)))
            }
            ExplicitMessageRight { identity, allow } => {
                self.ensure_admin_or_moderator(from)?;
                if !self.valid_identity_id(identity) {
                    return Err(NoSuchIdentity);
                }
                let old = self.message_rights.explicit.remove(&identity);
                if let Some(r) = allow {
                    self.message_rights.explicit.insert(identity, r);
                }
                Ok(Some(RestoreExplicitMessageRights {
                    identity,
                    allow: old,
                }))
            }
        }
    }

    pub fn restore(&mut self, event: RoomStateCancel) -> Result<(), RoomError> {
        use RoomStateCancel::*;
        match event {
            RemoveNewUser => {
                if let Some(id) = self.users.identities.pop() {
                    self.public_key_index.remove(&id.crypto_id.sign_key);
                    self.public_key_index
                        .remove(&id.crypto_id.encrypt_key.value);
                }
                self.users.next_id = match self.users.next_id {
                    Some(n) => n.previous(),
                    None => Some(UserID::MAX),
                };
                Ok(())
            }
            RemoveNewMask => {
                if let Some(id) = self.masks.identities.pop() {
                    self.public_key_index.remove(&id.crypto_id.sign_key);
                    self.public_key_index
                        .remove(&id.crypto_id.encrypt_key.value);
                }
                self.masks.next_id = match self.masks.next_id {
                    Some(n) => n.previous(),
                    None => Some(MaskID::MAX),
                };
                Ok(())
            }
            Connect(id) => {
                self.connected.insert(id);
                Ok(())
            }
            Disconnect(id) => {
                self.connected.remove(&id);
                Ok(())
            }
            RestoreRole { user, role } => {
                self.users.identities[usize::from(user)].role = role;
                Ok(())
            }
            RestoreIdentityInfo(info) => {
                fn doit<A>(
                    id_info: self::ChangeIdentityInfo,
                    i: &mut IdentityInfo<A>,
                ) -> Result<(), RoomError> {
                    if id_info.name.is_some() {
                        i.name = id_info.name;
                    }
                    if id_info.description.is_some() {
                        i.description = id_info.description;
                    }

                    Ok(())
                }

                use IdentityID::*;
                match info.identity {
                    RoomID => doit(info, &mut self.room),
                    User(id) => doit(info, &mut self.users.identities[usize::from(id)]),
                    Mask(id) => doit(info, &mut self.masks.identities[usize::from(id)]),
                }
            }
            RestoreRoomAccessibility(accessibility) => {
                self.room_accessibility = accessibility;
                Ok(())
            }
            RestoreMaxConnectedUsers(nb) => {
                self.max_connected_users = nb;
                Ok(())
            }
            RemoveNewQuestion => {
                let id_opt = match self.questions_state.next_id {
                    Some(n) => n.previous(),
                    None => Some(QuestionID::MAX),
                };
                self.questions_state.next_id = id_opt;
                if let Some(id) = id_opt {
                    self.questions_state.questions.remove(&id);
                }
                Ok(())
            }
            RemoveQuestionClarification(id) => {
                if let Some(info) = self.questions_state.questions.get_mut(&id) {
                    info.question.clarifications.pop();
                }
                Ok(())
            }
            RestoreLikeQuestion {
                from,
                question,
                like,
            } => {
                if let Some(info) = self.questions_state.questions.get_mut(&question) {
                    match like {
                        Some(l) => {
                            info.likes.insert(from, l);
                        }
                        None => {
                            info.likes.remove(&from);
                        }
                    }
                }
                Ok(())
            }
            RestoreQuestionPriority { question, priority } => {
                if let Some(info) = self.questions_state.questions.get_mut(&question) {
                    info.priority = priority;
                }
                Ok(())
            }
            RestoreDeletedQuestions(infos) => {
                for info in infos {
                    self.questions_state
                        .questions
                        .insert(info.question.id, info);
                }
                Ok(())
            }
            RestoreMaxQuestions(nb) => {
                self.questions_state.max_questions = nb;
                Ok(())
            }
            RestoreQuestionRights(role) => {
                self.questions_state.rights.role = role;
                Ok(())
            }
            RestoreExplicitQuestionRights { identity, allow } => {
                match allow {
                    Some(a) => {
                        self.questions_state.rights.explicit.insert(identity, a);
                    }
                    None => {
                        self.questions_state.rights.explicit.remove(&identity);
                    }
                }
                Ok(())
            }
            CancelOpenAnswering(info) => {
                self.answering = None;
                self.questions_state
                    .questions
                    .insert(info.question.id, info);
                Ok(())
            }
            ReopenAnswering(id) => {
                self.answering = Some(id);
                Ok(())
            }
            RestoreMessageRights(role) => {
                self.message_rights.role = role;
                Ok(())
            }
            RestoreExplicitMessageRights { identity, allow } => {
                match allow {
                    Some(a) => {
                        self.message_rights.explicit.insert(identity, a);
                    }
                    None => {
                        self.message_rights.explicit.remove(&identity);
                    }
                }
                Ok(())
            }
        }
    }
}
