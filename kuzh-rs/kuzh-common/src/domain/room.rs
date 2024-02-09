use crate::crypto::{CryptoID, PublicKey, SecretKey};
use never_type::Never;

pub type RoomIdentityID = IdentityID<MaskID, Never>;

use super::{
    chain::{Block, Nonce, SignedBlock, SignedTransaction, Transaction},
    identity::{
        AllowLevel, DutyRole, IdentityID, MaskID, RegularRole, Role, SharingDutyRole, UserID,
    },
    question::{QuestionID, QuestionKind, QuestionPriority},
};
use RegularRole::*;
use Role::*;
use RoomError::*;
use RoomEvent::*;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IdentityInfo {
    pub crypto_id: CryptoID,
    pub nonce: Nonce,
    pub role: Role,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Like {
    Like,
    Dislike,
}

pub enum RoomEvent {
    // Identities
    RoomCreation(Box<CryptoID>),
    NewUser(Box<CryptoID>),
    NewMask(Box<CryptoID>),
    SetRole {
        identity: RoomIdentityID,
        role: Role,
    },
    SetName(Option<String>),
    SetDescription(Option<String>),

    // Room
    SetRoomName(Option<String>),
    SetRoomDescription(Option<String>),
    SetRoomAccessibility(RoomAccessibility),
    SetMaxConnectedUsers(u16),

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
    SetQuestionPriority {
        question: QuestionID,
        priority: QuestionPriority,
    },
    DeleteQuestion(QuestionID),
    DeleteLowPriorityQuestions(QuestionPriority),

    // Question Rights
    SetMaxQuestions(u8),
    SetQuestionLevel(AllowLevel),

    // Messages
    Message(String),
    SetMessageLevel(AllowLevel),

    // Survey
    OpenSurvey,
    CloseSurvey,
    FinishedSurvey,
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
        survey_1: Box<Answer>,
        survey_2: Box<Answer>,
    },
    */
}

pub type RoomTransaction = Transaction<(), MaskID, Never, RoomEvent>;
pub type RoomSignedTransaction = SignedTransaction<(), MaskID, Never, RoomEvent>;
pub type RoomBlock = Block<(), MaskID, Never, RoomEvent>;
pub type RoomSignedBlock = SignedBlock<(), MaskID, Never, RoomEvent>;

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
    NoSurvey,
    SurveyAlreadyCreated,
    SurveyUnjoinable,
    InvalidRole,
    AlreadyJoined,
    InvalidSurveyPhase,
    ConnectionRefused,
}

pub type RoomResult<A> = Result<A, RoomError>;

pub trait RoomState {
    /// User Management
    async fn known_key(&self, key: &PublicKey) -> RoomResult<bool>;
    async fn new_user(&mut self, info: IdentityInfo) -> RoomResult<()>;
    async fn user_role(&self, user: UserID) -> RoomResult<Role>;
    async fn set_user_role(&self, user: UserID, role: Role) -> RoomResult<()>;

    async fn new_mask(&mut self, info: IdentityInfo) -> RoomResult<()>;
    async fn mask_role(&self, mask: MaskID) -> RoomResult<Option<RegularRole>>;
    async fn set_mask_role(&self, mask: MaskID, role: Option<RegularRole>) -> RoomResult<()>;

    async fn set_name(&mut self, identity: RoomIdentityID, name: Option<String>) -> RoomResult<()>;
    async fn set_description(
        &mut self,
        identity: RoomIdentityID,
        description: Option<String>,
    ) -> RoomResult<()>;

    // Room User Config
    async fn set_rooom_accessibility(&mut self, access: RoomAccessibility) -> RoomResult<()>;
    async fn set_max_connected_users(&mut self, nb_users: u16) -> RoomResult<()>;

    // User Questions
    async fn question_author(&self, question: QuestionID) -> RoomResult<RoomIdentityID>;
    async fn new_question(
        &mut self,
        from: RoomIdentityID,
        kind: QuestionKind,
        question: String,
    ) -> RoomResult<()>;

    async fn add_question_clarification(
        &mut self,
        question: QuestionID,
        clarification: String,
    ) -> RoomResult<()>;

    async fn like_question(
        &mut self,
        user: UserID,
        question: QuestionID,
        like: Option<Like>,
    ) -> RoomResult<()>;

    async fn is_question_alive(&self, question: QuestionID) -> RoomResult<bool>;
    async fn alive_question_count(&self) -> RoomResult<u8>;

    // Questions Config Management
    async fn set_max_questions(&mut self, nb_questions: u8) -> RoomResult<()>;
    async fn question_allow_level(&self) -> RoomResult<AllowLevel>;
    async fn set_question_allow_level(&mut self, allow_level: AllowLevel) -> RoomResult<()>;

    // Questions Management
    async fn set_question_priority(
        &mut self,
        question: QuestionID,
        priority: QuestionPriority,
    ) -> RoomResult<()>;

    async fn delete_question(&mut self, question: QuestionID) -> RoomResult<()>;
    async fn delete_low_priority_questions(&mut self, priority: QuestionPriority)
        -> RoomResult<()>;

    /// Message Management
    async fn new_message(&mut self, from: RoomIdentityID, message: String) -> RoomResult<()>;
    async fn message_allow_level(&self) -> RoomResult<AllowLevel>;
    async fn set_message_allow_level(&mut self, allow_level: AllowLevel) -> RoomResult<()>;

    /// Survey
    async fn is_survey_open(&self) -> RoomResult<bool>;
    async fn open_survey(&mut self) -> RoomResult<()>;
    async fn close_survey(&mut self) -> RoomResult<()>;
    async fn finished_survey(&mut self) -> RoomResult<()>;
}

pub async fn apply_room_event<A: RoomState>(
    room_state: &mut A,
    from: RoomIdentityID,
    event: RoomEvent,
) -> Result<(), RoomError> {
    macro_rules! identity_role {
        ($identity:expr) => {
            match $identity {
                IdentityID::User(user) => room_state.user_role(user).await?,
                IdentityID::RoomID => Role::Duty(SharingDutyRole {
                    duty: DutyRole::Owner,
                    giver: true,
                }),
                IdentityID::Mask(mask) => match room_state.mask_role(mask).await? {
                    Some(r) => Role::Regular(r),
                    None => Role::Banned,
                },
                IdentityID::Answer(_) => return Err(RoomError::NoSuchIdentity),
            }
        };
    }

    macro_rules! when_duty {
        ($exp:expr) => {
            if identity_role!(from).is_duty() {
                $exp
            } else {
                Err(Unauthorized)
            }
        };
    }

    match event {
        RoomCreation(_) => Err(RoomAlreadyCreated),
        NewUser(id) => {
            if from != RoomIdentityID::RoomID {
                return Err(Unauthorized);
            }
            if room_state.known_key(&id.sign_key).await?
                || room_state.known_key(&id.encrypt_key.value).await?
            {
                return Err(PublicKeyAlreadyUsed);
            }
            room_state
                .new_user(IdentityInfo {
                    crypto_id: *id,
                    nonce: Nonce::new(),
                    role: Regular(Asker),
                    name: None,
                    description: None,
                })
                .await
        }
        NewMask(id) => {
            if room_state.known_key(&id.sign_key).await?
                || room_state.known_key(&id.encrypt_key.value).await?
            {
                return Err(PublicKeyAlreadyUsed);
            }
            room_state
                .new_mask(IdentityInfo {
                    crypto_id: *id,
                    nonce: Nonce::new(),
                    role: Regular(Asker),
                    name: None,
                    description: None,
                })
                .await
        }
        SetRole { identity, role } => {
            use IdentityID::*;
            use Role::*;
            use RoomError::*;

            if from == identity {
                return Err(Unauthorized);
            }

            if identity_role!(from).can_grant_role(identity_role!(identity), role) {
                match identity {
                    RoomID => Err(Unauthorized),
                    User(user) => room_state.set_user_role(user, role).await,
                    Mask(mask) => {
                        let mask_role = match role {
                            Regular(rr) => Some(rr),
                            Banned => None,
                            _ => return Err(Unauthorized),
                        };

                        room_state.set_mask_role(mask, mask_role).await
                    }
                    Answer(_) => Err(RoomError::NoSuchIdentity),
                }
            } else {
                Err(Unauthorized)
            }
        }
        SetName(name) => room_state.set_name(from, name).await,
        SetDescription(description) => room_state.set_description(from, description).await,
        // Room
        SetRoomName(name) => when_duty!(room_state.set_name(IdentityID::RoomID, name).await),
        SetRoomDescription(description) => when_duty!(
            room_state
                .set_description(IdentityID::RoomID, description)
                .await
        ),
        SetRoomAccessibility(access) => {
            when_duty!(room_state.set_rooom_accessibility(access).await)
        }
        SetMaxConnectedUsers(nb_users) => {
            when_duty!(room_state.set_max_connected_users(nb_users).await)
        }
        // Questions
        NewQuestion { kind, question } => {
            let from_role = identity_role!(from);

            if from_role >= Role::Regular(RegularRole::Asker)
                && room_state.question_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                room_state.new_question(from, kind, question).await
            } else {
                Err(Unauthorized)
            }
        }
        ClarifyQuestion {
            question,
            clarification,
        } => {
            if room_state.question_author(question).await? == from && identity_role!(from) != Banned
            {
                room_state
                    .add_question_clarification(question, clarification)
                    .await
            } else {
                Err(Unauthorized)
            }
        }
        LikeQuestion { question, like } => match from {
            IdentityID::User(user_id)
                if room_state.user_role(user_id).await? != Banned
                    && room_state.is_question_alive(question).await? =>
            {
                room_state.like_question(user_id, question, like).await
            }
            _ => Err(Unauthorized),
        },
        SetQuestionPriority { question, priority } => {
            when_duty!(room_state.set_question_priority(question, priority).await)
        }
        DeleteQuestion(question) => when_duty!(room_state.delete_question(question).await),
        DeleteLowPriorityQuestions(priority) => {
            when_duty!(room_state.delete_low_priority_questions(priority).await)
        }
        // Question Rights
        SetMaxQuestions(nb_questions) => {
            when_duty!(room_state.set_max_questions(nb_questions).await)
        }
        SetQuestionLevel(level) => when_duty!(room_state.set_question_allow_level(level).await),

        // Messages
        Message(msg) => {
            let from_role = identity_role!(from);

            if from_role >= Role::Regular(RegularRole::Messager)
                && room_state.message_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                room_state.new_message(from, msg).await
            } else {
                Err(Unauthorized)
            }
        }
        SetMessageLevel(level) => when_duty!(room_state.set_message_allow_level(level).await),

        // Survey
        OpenSurvey => when_duty!(if room_state.alive_question_count().await? >= 1 {
            room_state.open_survey().await
        } else {
            Err(NoSurvey)
        }),
        CloseSurvey => when_duty!(if room_state.is_survey_open().await? {
            room_state.close_survey().await
        } else {
            Err(NoSurvey)
        }),
        FinishedSurvey => when_duty!(if room_state.is_survey_open().await? {
            room_state.finished_survey().await
        } else {
            Err(NoSurvey)
        }),
    }
}

impl RoomState {
    

pub async fn apply_event(
    & mut self,
    from: RoomIdentityID,
    event: RoomEvent,
) -> Result<(), RoomError> {
    macro_rules! identity_role {
        ($identity:expr) => {
            match $identity {
                IdentityID::User(user) => room_state.user_role(user).await?,
                IdentityID::RoomID => Role::Duty(SharingDutyRole {
                    duty: DutyRole::Owner,
                    giver: true,
                }),
                IdentityID::Mask(mask) => match room_state.mask_role(mask).await? {
                    Some(r) => Role::Regular(r),
                    None => Role::Banned,
                },
                IdentityID::Answer(_) => return Err(RoomError::NoSuchIdentity),
            }
        };
    }

    macro_rules! when_duty {
        ($exp:expr) => {
            if identity_role!(from).is_duty() {
                $exp
            } else {
                Err(Unauthorized)
            }
        };
    }

    match event {
        RoomCreation(_) => Err(RoomAlreadyCreated),
        NewUser(id) => {
            if from != RoomIdentityID::RoomID {
                return Err(Unauthorized);
            }
            if room_state.known_key(&id.sign_key).await?
                || room_state.known_key(&id.encrypt_key.value).await?
            {
                return Err(PublicKeyAlreadyUsed);
            }
            room_state
                .new_user(IdentityInfo {
                    crypto_id: *id,
                    nonce: Nonce::new(),
                    role: Regular(Asker),
                    name: None,
                    description: None,
                })
                .await
        }
        NewMask(id) => {
            if room_state.known_key(&id.sign_key).await?
                || room_state.known_key(&id.encrypt_key.value).await?
            {
                return Err(PublicKeyAlreadyUsed);
            }
            room_state
                .new_mask(IdentityInfo {
                    crypto_id: *id,
                    nonce: Nonce::new(),
                    role: Regular(Asker),
                    name: None,
                    description: None,
                })
                .await
        }
        SetRole { identity, role } => {
            use IdentityID::*;
            use Role::*;
            use RoomError::*;

            if from == identity {
                return Err(Unauthorized);
            }

            if identity_role!(from).can_grant_role(identity_role!(identity), role) {
                match identity {
                    RoomID => Err(Unauthorized),
                    User(user) => room_state.set_user_role(user, role).await,
                    Mask(mask) => {
                        let mask_role = match role {
                            Regular(rr) => Some(rr),
                            Banned => None,
                            _ => return Err(Unauthorized),
                        };

                        room_state.set_mask_role(mask, mask_role).await
                    }
                    Answer(_) => Err(RoomError::NoSuchIdentity),
                }
            } else {
                Err(Unauthorized)
            }
        }
        SetName(name) => room_state.set_name(from, name).await,
        SetDescription(description) => room_state.set_description(from, description).await,
        // Room
        SetRoomName(name) => when_duty!(room_state.set_name(IdentityID::RoomID, name).await),
        SetRoomDescription(description) => when_duty!(
            room_state
                .set_description(IdentityID::RoomID, description)
                .await
        ),
        SetRoomAccessibility(access) => {
            when_duty!(room_state.set_rooom_accessibility(access).await)
        }
        SetMaxConnectedUsers(nb_users) => {
            when_duty!(room_state.set_max_connected_users(nb_users).await)
        }
        // Questions
        NewQuestion { kind, question } => {
            let from_role = identity_role!(from);

            if from_role >= Role::Regular(RegularRole::Asker)
                && room_state.question_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                room_state.new_question(from, kind, question).await
            } else {
                Err(Unauthorized)
            }
        }
        ClarifyQuestion {
            question,
            clarification,
        } => {
            if room_state.question_author(question).await? == from && identity_role!(from) != Banned
            {
                room_state
                    .add_question_clarification(question, clarification)
                    .await
            } else {
                Err(Unauthorized)
            }
        }
        LikeQuestion { question, like } => match from {
            IdentityID::User(user_id)
                if room_state.user_role(user_id).await? != Banned
                    && room_state.is_question_alive(question).await? =>
            {
                room_state.like_question(user_id, question, like).await
            }
            _ => Err(Unauthorized),
        },
        SetQuestionPriority { question, priority } => {
            when_duty!(room_state.set_question_priority(question, priority).await)
        }
        DeleteQuestion(question) => when_duty!(room_state.delete_question(question).await),
        DeleteLowPriorityQuestions(priority) => {
            when_duty!(room_state.delete_low_priority_questions(priority).await)
        }
        // Question Rights
        SetMaxQuestions(nb_questions) => {
            when_duty!(room_state.set_max_questions(nb_questions).await)
        }
        SetQuestionLevel(level) => when_duty!(room_state.set_question_allow_level(level).await),

        // Messages
        Message(msg) => {
            let from_role = identity_role!(from);

            if from_role >= Role::Regular(RegularRole::Messager)
                && room_state.message_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                room_state.new_message(from, msg).await
            } else {
                Err(Unauthorized)
            }
        }
        SetMessageLevel(level) => when_duty!(room_state.set_message_allow_level(level).await),

        // Survey
        OpenSurvey => when_duty!(if room_state.alive_question_count().await? >= 1 {
            room_state.open_survey().await
        } else {
            Err(NoSurvey)
        }),
        CloseSurvey => when_duty!(if room_state.is_survey_open().await? {
            room_state.close_survey().await
        } else {
            Err(NoSurvey)
        }),
        FinishedSurvey => when_duty!(if room_state.is_survey_open().await? {
            room_state.finished_survey().await
        } else {
            Err(NoSurvey)
        }),
    }
}
