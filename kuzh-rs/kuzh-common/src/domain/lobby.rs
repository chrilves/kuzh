use crate::{crypto::CryptoID, domain::room::{RegularRole, RoomIdentityID}};

use super::room::{AllowLevel, Role, UserID};

id_type!(QuestionID, u16);
id_type!(AnonymousID, u16);


#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum QuestionKind {
    Open,
    Closed,
    Poll(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum LobbyIdentityID {
    Room,
    User(UserID),
    Anonymous(AnonymousID)
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Question {
    pub id: QuestionID,
    pub from: LobbyIdentityID,
    pub kind: QuestionKind,
    pub question: String,
    pub clarifications: Vec<String>,
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

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Like {
    Like,
    Dislike,
}

pub enum LobbyEvent {
    NewAnonymous(Box<CryptoID>),

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

    // Survey
    OpenSurvey,
    CloseSurvey,
    FinishedSurvey,
}

pub enum LobbyError {
    NoSuchQuestion,
    NoSuchSurvey,
    Unauthorized,
}

pub type LobbyResult<A> = Result<A, LobbyError>;

pub trait LobbyState {
    // User Questions
    async fn question_author(&self, question: QuestionID) -> LobbyResult<RoomIdentityID>;
    async fn new_question(
        &mut self,
        from: RoomIdentityID,
        kind: QuestionKind,
        question: String,
    ) -> LobbyResult<()>;

    async fn add_question_clarification(
        &mut self,
        question: QuestionID,
        clarification: String,
    ) -> LobbyResult<()>;

    async fn like_question(
        &mut self,
        user: UserID,
        question: QuestionID,
        like: Option<Like>,
    ) -> LobbyResult<()>;

    async fn is_question_alive(&self, question: QuestionID) -> LobbyResult<bool>;
    async fn alive_question_count(&self) -> LobbyResult<u8>;

    // Questions Config Management
    async fn set_max_questions(&mut self, nb_questions: u8) -> LobbyResult<()>;
    async fn question_allow_level(&self) -> LobbyResult<AllowLevel>;
    async fn set_question_allow_level(&mut self, allow_level: AllowLevel) -> LobbyResult<()>;

    // Questions Management
    async fn set_question_priority(
        &mut self,
        question: QuestionID,
        priority: QuestionPriority,
    ) -> LobbyResult<()>;

    async fn delete_question(&mut self, question: QuestionID) -> LobbyResult<()>;
    async fn delete_low_priority_questions(
        &mut self,
        priority: QuestionPriority,
    ) -> LobbyResult<()>;

    /// Survey
    async fn is_survey_open(&self) -> LobbyResult<bool>;
    async fn open_survey(&mut self) -> LobbyResult<()>;
    async fn close_survey(&mut self) -> LobbyResult<()>;
    async fn finished_survey(&mut self) -> LobbyResult<()>;
}

pub async fn apply_room_event<L: LobbyState>(
    lobby_state: &mut L,
    from: LobbyIdentityID,
    from_role: Role,
    event: LobbyEvent,
) -> LobbyResult<()> {
    use LobbyError::*;
    use LobbyEvent::*;
    use Role::*;

    macro_rules! when_duty {
        ($exp:expr) => {
            if from_role.is_duty() {
                $exp
            } else {
                Err(Unauthorized)
            }
        };
    }

    match event {
        NewQuestion { kind, question } => {
            if from_role >= Role::Regular(RegularRole::Asker)
                && lobby_state.question_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                lobby_state.new_question(from, kind, question).await
            } else {
                Err(Unauthorized)
            }
        }
        ClarifyQuestion {
            question,
            clarification,
        } => {
            if lobby_state.question_author(question).await? == from && from_role != Banned {
                lobby_state
                    .add_question_clarification(question, clarification)
                    .await
            } else {
                Err(Unauthorized)
            }
        }
        LikeQuestion { question, like } => match from {
            IdentityID::User(user_id)
                if from_role != Banned && lobby_state.is_question_alive(question).await? =>
            {
                lobby_state.like_question(user_id, question, like).await
            }
            _ => Err(Unauthorized),
        },
        SetQuestionPriority { question, priority } => {
            when_duty!(lobby_state.set_question_priority(question, priority).await)
        }
        DeleteQuestion(question) => when_duty!(lobby_state.delete_question(question).await),
        DeleteLowPriorityQuestions(priority) => {
            when_duty!(lobby_state.delete_low_priority_questions(priority).await)
        }
        // Question Rights
        SetMaxQuestions(nb_questions) => {
            when_duty!(lobby_state.set_max_questions(nb_questions).await)
        }
        SetQuestionLevel(level) => when_duty!(lobby_state.set_question_allow_level(level).await),

        // Survey
        OpenSurvey => when_duty!(if lobby_state.alive_question_count().await? >= 1 {
            lobby_state.open_survey().await
        } else {
            Err(NoSuchQuestion)
        }),
        CloseSurvey => when_duty!(if lobby_state.is_survey_open().await? {
            lobby_state.close_survey().await
        } else {
            Err(NoSuchSurvey)
        }),
        FinishedSurvey => when_duty!(if lobby_state.is_survey_open().await? {
            lobby_state.finished_survey().await
        } else {
            Err(NoSuchSurvey)
        }),
    }
}
