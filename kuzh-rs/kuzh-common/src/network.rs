use crate::{
    chain::{AnyBlock, AnyTransaction},
    crypto::EncryptedMessageData,
    newtypes::UserID,
};

pub struct EncryptedMessage {
    pub from: UserID,
    pub to: UserID,
    pub data: EncryptedMessageData,
}

pub enum ClientMesage {
    Transaction(AnyTransaction),
    NetworkMessage(Box<EncryptedMessage>),
}

pub enum ServerMesage {
    Block(AnyBlock),
    NetworkMessage(Box<EncryptedMessage>),
}
