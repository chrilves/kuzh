use crate::{
    chain::{AnsweringBlock, AnsweringTransaction, RoomBlock, RoomTransaction},
    common::IdentityID,
    crypto::EncryptedMessageData,
    newtypes::UserID,
};

pub struct EncryptedMessage {
    pub from: IdentityID<()>,
    pub to: UserID,
    pub data: EncryptedMessageData,
}

pub enum ClientMesage {
    RoomTransaction(RoomTransaction),
    AnsweringTransaction(AnsweringTransaction),
    NetworkMessage(Box<EncryptedMessage>),
}

pub enum ServerMesage {
    RoomBlock(RoomBlock),
    AnsweringBlock(AnsweringBlock),
    NetworkMessage(Box<EncryptedMessage>),
}
