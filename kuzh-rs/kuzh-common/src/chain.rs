use crate::{
    answering::events::AnsweringEvent,
    common::IdentityID,
    crypto::Signed,
    newtypes::{AnswerID, BlockHeight, Hashed, MaskID, Nonce, QuestionID},
    room::events::RoomEvent,
};

pub struct RawTransaction<ChainID, MaskID, Event> {
    pub chain: ChainID,
    pub from: IdentityID<MaskID>,
    pub events: Vec<Event>,
    pub nonce: Nonce,
}

pub type Transaction<ChainID, MaskID, Event> = Signed<RawTransaction<ChainID, MaskID, Event>>;

pub struct RawBlock<ChainID, MaskID, Event> {
    pub chain: ChainID,
    pub height: BlockHeight<Event>,
    pub parent_hash: Hashed,
    pub transactions: Vec<Transaction<ChainID, MaskID, Event>>,
}

pub type Block<ChainID, MaskID, Event> = Signed<RawBlock<ChainID, MaskID, Event>>;

pub type RoomRawTransaction = RawTransaction<(), MaskID, RoomEvent>;
pub type RoomTransaction = Transaction<(), MaskID, RoomEvent>;
pub type RoomRawBlock = RawBlock<(), MaskID, RoomEvent>;
pub type RoomBlock = Block<(), MaskID, RoomEvent>;

pub type AnsweringRawTransaction = RawTransaction<QuestionID, AnswerID, AnsweringEvent>;
pub type AnsweringTransaction = Transaction<QuestionID, AnswerID, AnsweringEvent>;
pub type AnsweringRawBlock = RawBlock<QuestionID, AnswerID, AnsweringEvent>;
pub type AnsweringBlock = Block<QuestionID, AnswerID, AnsweringEvent>;
