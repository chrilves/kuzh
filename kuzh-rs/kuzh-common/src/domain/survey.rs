#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecryptedAnswer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub answer: DecryptedAnswerBody,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecryptedAnswerBody {
    Open(String),
    Closed(bool),
    Poll(u8),
}
id_type!(AnswerID, u8);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answer {
    pub sign_key: PublicKey,
    pub encrypt_key: PublicKey,
    pub iteration: u64,
    pub answer: [u8; ANSWER_SIZE],
    pub ring_sig: RingSig,
    pub sig: Sig,
}

impl Answer {
    pub fn decrypt(&self, _secret: SecretKey) -> DecryptedAnswer {
        todo! {}
    }
}

pub enum SurveyEvent {
    CreateSurvey(Question),

    // User Management
    Join,
    Leave,
    Connected(UserID),
    Disconnected(UserID),
    Kick(UserID),
    Unkick(UserID),

    // Admin Management
    SetJoinability(bool),
    SetCollectability(bool),
    Go,

    // Anonymous Protocol
    Ready,
    PublicPartialKey {
        public_key: Box<PublicKey>,
        challenge: Box<Sig>,
    },
    NewAnswer(Box<Answer>),
    PrivatePartialKey(Box<SecretKey>),
}

pub type SurveyIdentityID = IdentityID<Never, AnswerID>;
pub const ANSWER_SIZE: usize = 300;

pub enum SurveyError {
    SurveyAlreadyCreated,
    Cheater,
}

type SurveyResult<A> = Result<A, SurveyError>;

trait RoomState4Survey {}

pub enum Phase {
    Startup,
    PublicKeys,
    Answers,
    SecretKeys,
    Debate,
    Failed
}

pub enum UserState {
    Present,
    Absent,
    Kicked
}

pub trait SurveyState {
    // ALL
    async fn phase(&self) -> SurveyResult<Phase>;

    async fn user_state(&self, user_id: UserID) -> SurveyResult<UserState>;
    async fn set_user_state(&self, user_id: UserID, user_state: UserState) -> SurveyResult<()>;

    // Startup
    async fn is_joinable(&self) -> SurveyResult<bool>;
    async fn set_joinable(&mut self, joinable: bool) -> SurveyResult<()>;

    async fn lobby_can_proceed(&self) -> SurveyResult<bool>;
    async fn lobby_set_can_proceed(&mut self, can_proceeed: bool) -> SurveyResult<()>;

    async fn lobby_new_user(&mut self, user: UserID) -> SurveyResult<()>;
}

pub async fn apply_survey_event<R: RoomState4Survey, S: SurveyState>(
    survey_state: &mut S,
    from: SurveyIdentityID,
    event: SurveyEvent,
) -> SurveyResult<()> {
    use SurveyError::*;
    use SurveyEvent::*;

    match event {
        CreateSurvey(..) => Err(SurveyAlreadyCreated),

        // User Management
        Join => {
            todo! {}
        }
        Leave => {
            todo! {}
        }
        Connected(user_id) => {
            todo! {}
        }
        Disconnected(user_id) => {
            todo! {}
        }
        Kick(user_id) => {
            todo! {}
        }
        Unkick(user_id) => {
            todo! {}
        }

        // Admin Management
        SetJoinability(joinability) => {
            todo! {}
        }
        SetCollectability(collectability) => {
            todo! {}
        }
        Go => {
            todo! {}
        }

        // Anonymous Protocol
        Ready => {
            todo! {}
        }
        PublicPartialKey {
            public_key,
            challenge,
        } => {
            todo! {}
        }
        NewAnswer(answer) => {
            todo! {}
        }
        PrivatePartialKey(secret_key) => {
            todo! {}
        }
    }
}