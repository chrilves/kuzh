use std::collections::HashMap;

use kuzh_common::{
    answering::AnsweringState, chain::AnyTransaction, crypto::SecretKey, network::ClientMesage,
    newtypes::UserID, room::RoomState,
};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};

struct UserDB {}

impl UserDB {}

struct RoomAgent {
    room_secret_key: SecretKey,
    room_state: RoomState,
    answering_state: Option<AnsweringState>,
    users: UserDB,

    transaction_sender: UnboundedSender<AnyTransaction>,
    transaction_receiver: UnboundedReceiver<AnyTransaction>,

    connected: HashMap<UserID, UserConnection>,
}

impl RoomAgent {}

pub struct UserConnection {
    pub message_sender: UnboundedSender<AnyTransaction>,
    pub message_receiver: UnboundedReceiver<ClientMesage>,
}

struct ServerState {}

pub async fn romm_chains_agent() {}

pub async fn user_connection() {}
