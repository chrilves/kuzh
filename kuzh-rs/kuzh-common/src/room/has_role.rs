use crate::{
    common::{IdentityID, Role},
    newtypes::UserID,
};

use super::state::{RoomError, RoomState};

pub trait HasRole {
    fn role(&self, room: &RoomState) -> Result<Role, RoomError>;

    fn ensure_admin_or_moderator(&self, room: &RoomState) -> Result<Role, RoomError> {
        let r = self.role(room)?;
        if r.is_admin_or_moderator() {
            Ok(r)
        } else {
            Err(RoomError::Unauthorized)
        }
    }

    fn ensure_not_banned(&self, room: &RoomState) -> Result<Role, RoomError> {
        let r = self.role(room)?;
        if r.is_not_banned() {
            Ok(r)
        } else {
            Err(RoomError::Unauthorized)
        }
    }
}

impl HasRole for UserID {
    fn role(&self, room: &RoomState) -> Result<Role, RoomError> {
        match room.users.identities.get::<usize>(usize::from(*self)) {
            Some(u) => Ok(u.role),
            None => Err(RoomError::NoSuchUser),
        }
    }
}

impl<A> HasRole for IdentityID<A> {
    fn role(&self, room: &RoomState) -> Result<Role, RoomError> {
        use IdentityID::*;
        use Role::*;
        match self {
            RoomID => Ok(Admin),
            User(uid) => uid.role(room),
            Mask(_) => Ok(Regular),
        }
    }
}
