use crate::crypto::{PublicKey, RingSig, SecretKey, Sig};

use super::{
    chain::{Block, SignedBlock, SignedTransaction, Transaction},
    identity::{AllowLevel, AnswerID, IdentityID, MaskID, UserID},
    question::{Question, QuestionID},
    room::RoomState,
};

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

    // Messages
    Message(String),
    SetMessageLevel(AllowLevel),
}

pub type SurveyIdentityID = IdentityID<MaskID, AnswerID>;
pub const ANSWER_SIZE: usize = 300;

pub type SurveyTransaction = Transaction<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveySignedTransaction = SignedTransaction<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveyRawBlock = Block<QuestionID, MaskID, AnswerID, SurveyEvent>;
pub type SurveyBlock = SignedBlock<QuestionID, MaskID, AnswerID, SurveyEvent>;

pub enum SurveyError {}

type SurveyResult<A> = Result<A, SurveyError>;

trait RoomState4Survey {}

pub trait SurveyState {}

pub async fn apply_survey_event<R: RoomState4Survey, S: SurveyState>(
    &mut survey_state: S,
    room_state: &R,
    from: SurveyIdentityID,
    event: SurveyEvent,
) -> SurveyResult<()> {

    match event {
        
    }


}
