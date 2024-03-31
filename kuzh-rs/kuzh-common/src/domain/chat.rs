use crate::domain::room::RegularRole;

use super::room::{AllowLevel, IdentityID, Role};

id_type!(MessageID, u64);

pub enum ChatEvent {
    Message(String),
    SetMessageLevel(AllowLevel),
}

pub enum ChatError {
    Unauthorized,
}

pub type ChatResult<A> = Result<A, ChatError>;

pub trait ChatState<M, A> {
    /// Message Management
    async fn new_message(&mut self, from: IdentityID<M, A>, message: String) -> ChatResult<()>;
    async fn message_allow_level(&self) -> ChatResult<AllowLevel>;
    async fn set_message_allow_level(&mut self, allow_level: AllowLevel) -> ChatResult<()>;
}

pub async fn apply_room_event<M: Copy, A: Copy, C: ChatState<M, A>>(
    chat_state: &mut C,
    from: IdentityID<M, A>,
    from_role: Role,
    event: ChatEvent,
) -> ChatResult<()> {
    use ChatError::*;
    use ChatEvent::*;

    macro_rules! when_duty {
        ($exp:expr) => {
            if from_role.is_duty() {
                $exp
            } else {
                Err(Unauthorized)
            }
        };
    }

    match event {
        // Messages
        Message(msg) => {
            if from_role >= Role::Regular(RegularRole::Messager)
                && chat_state.message_allow_level().await?
                    <= AllowLevel::from_role_id(from_role, from).ok_or(Unauthorized)?
            {
                chat_state.new_message(from, msg).await
            } else {
                Err(Unauthorized)
            }
        }
        SetMessageLevel(level) => when_duty!(chat_state.set_message_allow_level(level).await),
    }
}
