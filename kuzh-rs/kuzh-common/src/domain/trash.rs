NewMask(Box<CryptoID>),

    #[derive(Debug, Copy, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub enum AllowLevel {
    Anonymous,
    Regular,
    Duty,
}

impl AllowLevel {
    pub fn from_role_id<M, A>(role: Role, identity: IdentityID<M, A>) -> Option<AllowLevel> {
        match role {
            Role::Duty(..) => Some(AllowLevel::Duty),
            Role::Regular(_) => match identity {
                IdentityID::User(..) => Some(AllowLevel::Regular),
                IdentityID::Mask(..) | IdentityID::Answer(..) => Some(AllowLevel::Anonymous),
                IdentityID::RoomID => None,
            },
            Role::Banned => None,
        }
    }
}

async fn new_mask(&mut self, info: IdentityInfo) -> RoomResult<MaskID>;
    async fn mask_role(
        &self,
        mask: MaskID,
        height: Option<BlockHeight>,
    ) -> RoomResult<Option<RegularRole>>;
    async fn set_mask_role(&self, mask: MaskID, role: Option<RegularRole>) -> RoomResult<()>;


        /*pub async fn identity_role<R:RoomState, A>(room_state: &R, identity: IdentityID<MaskID, A>) -> RoomResult<Role> {
    match identity {
        IdentityID::User(user) => room_state.user_role(user).await,
        IdentityID::RoomID => Ok(Role::Duty(SharingDutyRole {
            duty: DutyRole::Owner,
            giver: true,
        })),
        IdentityID::Mask(mask) => match room_state.mask_role(mask).await? {
            Some(r) => Ok(Role::Regular(r)),
            None => Ok(Role::Banned),
        },
        IdentityID::Answer(_) => Err(RoomError::NoSuchIdentity),
    }
}*/

macro_rules! identity_role {
    ($identity:expr) => {
        match $identity {
            IdentityID::User(user) => room_state.user_role(user, None).await?,
            IdentityID::RoomID => Role::Duty(SharingDutyRole {
                duty: DutyRole::Owner,
                giver: true,
            }),
            IdentityID::Mask(mask) => match room_state.mask_role(mask, None).await? {
                Some(r) => Role::Regular(r),
                None => Role::Banned,
            },
            IdentityID::Answer(_) => return Err(RoomError::NoSuchIdentity),
        }
    };
}

NewMask(id) => {
    if room_state.find_id_by_key(&id.sign_key).await?.is_some()
        || room_state
            .find_id_by_key(&id.encrypt_key.value)
            .await?
            .is_some()
    {
        return Err(PublicKeyAlreadyUsed);
    }
    room_state
        .new_mask(IdentityInfo {
            crypto_id: *id,
            role: Regular(Asker),
            name: None,
            description: None,
        })
        .await
        .map(|_| ())
}

SetRole { identity, role, .. } => {
    use RoomIdentityID::*;
    use Role::*;
    use RoomError::*;

    if from == identity {
        return Err(Unauthorized);
    }

    if identity_role!(from).can_grant_role(identity_role!(identity), role) {
        match identity {
            RoomID => Err(Unauthorized),
            User(user) => room_state.set_user_role(user, role).await,
            Mask(mask) => {
                let mask_role = match role {
                    Regular(rr) => Some(rr),
                    Banned => None,
                    _ => return Err(Unauthorized),
                };

                room_state.set_mask_role(mask, mask_role).await
            }
            Answer(_) => Err(RoomError::NoSuchIdentity),
        }
    } else {
        Err(Unauthorized)
    }
}