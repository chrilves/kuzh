use crate::{
    answering::AnsweringEvent,
    crypto::Signed,
    newtypes::{Hashed, MaskID, Nonce, UserID},
    room::RoomEvent,
};

pub struct Transaction<Event> {
    pub chain: u64,
    pub from: UserID,
    pub events: Vec<Event>,
    pub nonce: Nonce,
}

pub type SignedTransaction<Event> = Signed<Transaction<Event>>;

pub struct Block<Event> {
    pub chain: u64,
    pub height: u64,
    pub parent_hash: Hashed,
    pub transactions: Vec<Transaction<Event>>,
}

pub type SignedBlock<Event> = Signed<Block<Event>>;

pub enum AnyTransaction {
    Room(SignedTransaction<RoomEvent>),
    Answering(SignedTransaction<AnsweringEvent>),
}

pub enum AnyBlock {
    Room(SignedBlock<RoomEvent>),
    Answering(SignedBlock<AnsweringEvent>),
}
