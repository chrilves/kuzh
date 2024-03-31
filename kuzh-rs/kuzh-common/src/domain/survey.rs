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

pub type SurveyIdentityID = IdentityID<MaskID, AnswerID>;
pub const ANSWER_SIZE: usize = 300;

pub type SurveyTransaction = Transaction<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveySignedTransaction = SignedTransaction<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveyRawBlock = Block<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveyBlock = SignedBlock<QuestionID, MaskID, AnswerID, SurveyEvent>;

pub enum SurveyError {
    SurveyAlreadyCreated,
}

type SurveyResult<A> = Result<A, SurveyError>;

trait RoomState4Survey {}

pub enum Phase {
    Lobby,
    PublicKeys,
    Answers,
    SecretKeys,
    Debate,
    Failed
}


pub trait SurveyState {

    // ALL
    async fn phase(&self) -> SurveyResult<Phase>;

    async fn new_mask(&mut self, mask: CryptoID) -> SurveyResult<MaskID>;
    async fn new_message(&mut self, from: SurveyIdentityID, message: String) -> SurveyResult<()>;

    // LOBBY
    async fn lobby_can_join(&self) -> SurveyResult<bool>;
    async fn lobby_set_can_join(&mut self, can_join: bool) -> SurveyResult<()>;

    async fn lobby_can_proceed(&self) -> SurveyResult<bool>;
    async fn lobby_set_can_proceed(&mut self, can_proceeed: bool) -> SurveyResult<()>;

    async fn lobby_new_user(&mut self, user: UserID) -> SurveyResult<()>;
    
}

pub async fn apply_survey_event<R: RoomState4Survey, S: SurveyState>(
    survey_state: &mut S,
    room_state: &R,
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