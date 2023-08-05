use crate::{
    chain::{AnyBlock, AnyTransaction},
    crypto::EncryptedMessageData,
    newtypes::{MaskID, UserID},
};

pub struct EncryptedMessage {
    pub from: UserID,
    pub to: UserID,
    pub data: EncryptedMessageData,
}

pub enum ClientMesage {
    Transaction(AnyTransaction),
    NetworkMessage(EncryptedMessage),
}

pub enum ServerMesage {
    Block(AnyBlock),
    NetworkMessage(EncryptedMessage),
}
