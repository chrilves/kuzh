use crate::{
    answering::AnsweringEvent,
    crypto::Signed,
    newtypes::{BlockHeight, Hashed, Nonce, QuestionID, UserID},
    room::RoomEvent,
};

pub struct RawTransaction<ChainID, Event> {
    pub chain: ChainID,
    pub from: UserID,
    pub events: Vec<Event>,
    pub nonce: Nonce,
}

pub type Transaction<ChainID, Event> = Signed<RawTransaction<ChainID, Event>>;

pub struct RawBlock<ChainID, Event> {
    pub chain: ChainID,
    pub height: BlockHeight<Event>,
    pub parent_hash: Hashed,
    pub transactions: Vec<Transaction<ChainID, Event>>,
}

pub type Block<ChainID, Event> = Signed<RawBlock<ChainID, Event>>;

pub type RoomTransaction = Transaction<(), RoomEvent>;
pub type RoomBlock = Block<(), RoomEvent>;

pub type AnsweringTransaction = Transaction<QuestionID, AnsweringEvent>;
pub type AnsweringBlock = Block<QuestionID, AnsweringEvent>;
