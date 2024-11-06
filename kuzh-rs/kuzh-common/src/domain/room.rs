use crate::crypto::{CryptoID, PublicKey, SecretKey, Sig};

use super::BlockHeight;

id_type!(UserID, u16);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RoomIdentityID {
    RoomID,
    User(UserID)
}

impl RoomIdentityID {
    #[inline(always)]
    pub fn is_user(self) -> bool {
        use RoomIdentityID::*;
        matches!(self, User(_))
    }
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub enum DutyRole {
    Moderator,
    Admin,
    Owner,
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq)]
pub struct SharingDutyRole {
    pub duty: DutyRole,
    pub giver: bool,
}

impl PartialOrd for SharingDutyRole {
    #[inline(always)]
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SharingDutyRole {
    #[inline(always)]
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.duty.cmp(&other.duty)
    }
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub enum RegularRole {
    Observer,
    Messager,
    Asker,
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub enum Role {
    Banned,
    Regular(RegularRole),
    Duty(SharingDutyRole),
}

impl Role {
    #[inline(always)]
    pub const fn is_duty(self) -> bool {
        use Role::*;
        matches!(self, Duty { .. })
    }

    #[inline(always)]
    pub const fn duty(self) -> Option<SharingDutyRole> {
        use Role::*;
        match self {
            Duty(sd) => Some(sd),
            _ => None,
        }
    }

    #[inline(always)]
    pub const fn is_banned(self) -> bool {
        matches!(self, Role::Banned)
    }

    pub fn can_grant_role(self, to: Self, role: Role) -> bool {
        match self {
            Role::Duty(sd) if self > to && self >= role => {
                if self == role {
                    sd.giver
                } else {
                    false
                }
            }
            _ => false,
        }
    }
}

#[derive(Debug, Copy, Clone, Hash, Eq, PartialEq, PartialOrd, Ord)]
pub enum AllowLevel {
    Anonymous,
    Regular,
    Duty,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IdentityInfo {
    pub crypto_id: CryptoID,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum RoomAccessibility {
    OpenToAnyone,
    MembersOnly,
    PublicKeyProtected(Box<PublicKey>),
    SecretKeyProtected(Box<SecretKey>),
}

pub enum Cheater {
    CheaterWrongCommitment {
        context: Box<[u8]>,
        user: UserID,
        encryption: Box<(PublicKey, Sig)>,
        secret: Box<(SecretKey, Sig)>,
    },
    CheaterTwoAnswers {
        context: Box<[u8]>,
        user: UserID,
        //survey_1: Answer,
        //survey_2: Answer,
    },
}

pub enum RoomEvent {
    // Identities
    RoomCreation(Box<CryptoID>),
    NewUser(Box<CryptoID>),
    SetRole {
        identity: RoomIdentityID,
        role: Role
    },
    SetName(Option<String>),
    SetDescription(Option<String>),

    // Room
    SetRoomName(Option<String>),
    SetRoomDescription(Option<String>),
    SetRoomAccessibility(RoomAccessibility),
    SetMaxConnectedUsers(u16),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoomError {
    NameAlreadyTaken,
    NoSuchIdentity,
    PublicKeyAlreadyUsed,
    RoomAlreadyCreated,
    Unauthorized,
}

pub type RoomResult<A> = Result<A, RoomError>;

pub trait RoomState {
    /// User Management
    async fn find_id_by_key(&self, key: &PublicKey) -> RoomResult<Option<RoomIdentityID>>;
    async fn find_id_by_name(&self, name: &str) -> RoomResult<Option<RoomIdentityID>>;

    async fn new_user(&mut self, info: IdentityInfo) -> RoomResult<UserID>;
    async fn user_role(&self, user: UserID, height: Option<BlockHeight>) -> RoomResult<Role>;
    async fn set_user_role(&self, user: UserID, role: Role) -> RoomResult<()>;

    async fn set_name(&mut self, identity: RoomIdentityID, name: Option<String>) -> RoomResult<()>;
    async fn set_description(
        &mut self,
        identity: RoomIdentityID,
        description: Option<String>,
    ) -> RoomResult<()>;

    // Room User Config
    async fn set_rooom_accessibility(&mut self, access: RoomAccessibility) -> RoomResult<()>;
    async fn set_max_connected_users(&mut self, nb_users: u16) -> RoomResult<()>;
}


pub async fn apply_room_event<A: RoomState>(
    room_state: &mut A,
    from: RoomIdentityID,
    event: RoomEvent,
) -> Result<(), RoomError> {
    use RegularRole::*;
    use Role::*;
    use RoomError::*;
    use RoomEvent::*;

    macro_rules! identity_role {
        ($identity:expr) => {
            match $identity {
                RoomIdentityID::User(user) => room_state.user_role(user, None).await?,
                RoomIdentityID::RoomID => Role::Duty(SharingDutyRole {
                    duty: DutyRole::Owner,
                    giver: true,
                }),
            }
        };
    }

    macro_rules! when_duty {
        ($exp:expr) => {
            if identity_role!(from).is_duty() {
                $exp
            } else {
                Err(Unauthorized)
            }
        };
    }

    match event {
        RoomCreation(_) => Err(RoomAlreadyCreated),
        NewUser(id) => {
            if from != RoomIdentityID::RoomID {
                return Err(Unauthorized);
            }
            if room_state.find_id_by_key(&id.sign_key).await?.is_some()
                || room_state
                    .find_id_by_key(&id.encrypt_key.value)
                    .await?
                    .is_some()
            {
                return Err(PublicKeyAlreadyUsed);
            }
            let user_id = room_state
                .new_user(IdentityInfo {
                    crypto_id: *id,
                    name: None,
                    description: None,
                })
                .await?;
            room_state.set_user_role(user_id, Regular(Asker)).await
        }
        SetRole { identity, role, .. } => {
            use RoomIdentityID::*;
            use RoomError::*;

            if from == identity {
                return Err(Unauthorized);
            }

            if identity_role!(from).can_grant_role(identity_role!(identity), role) {
                match identity {
                    RoomID => Err(Unauthorized),
                    User(user) => room_state.set_user_role(user, role).await,
                }
            } else {
                Err(Unauthorized)
            }
        }
        SetName(name) => {
            match name {
                Some(n) if room_state.find_id_by_name(&n).await?.is_some() => {
                    return Err(NameAlreadyTaken)
                }
                _ => (),
            }
            room_state.set_name(from, name).await
        }
        SetDescription(description) => room_state.set_description(from, description).await,
        // Room
        SetRoomName(name) => when_duty!(room_state.set_name(RoomIdentityID::RoomID, name).await),
        SetRoomDescription(description) => when_duty!(
            room_state
                .set_description(RoomIdentityID::RoomID, description)
                .await
        ),
        SetRoomAccessibility(access) => {
            when_duty!(room_state.set_rooom_accessibility(access).await)
        }
        SetMaxConnectedUsers(nb_users) => {
            when_duty!(room_state.set_max_connected_users(nb_users).await)
        }
    }
}
