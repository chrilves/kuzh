use crate::crypto::*;
use crate::gate::*;

pub struct Transaction<Event> {
    from: User,
    events: Vec<Event>,
    nonce: Nonce,
    signature: Sig,
    nonce_sig: Sig,
}

pub enum QuestionKind {
    Open,
    Closed,
}

pub struct Question {
    id: QuestionID,
    kind: QuestionKind,
    question: String,
}

pub struct Message {
    from: Option<User>,
    message: String,
}
