use curve25519_dalek::traits::Identity;
use futures_util::stream::All;

id_type!(UserID, u16);
id_type!(MaskID, u32);
id_type!(AnswerID, u8);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum IdentityID<M, A> {
    RoomID,
    User(UserID),
    Mask(M),
    Answer(A),
}

impl<M, A> IdentityID<M, A> {
    #[inline(always)]
    pub fn is_anonymous(self) -> bool {
        use IdentityID::*;
        matches!(self, Mask(_) | Answer(_))
    }

    #[inline(always)]
    pub fn is_user(self) -> bool {
        use IdentityID::*;
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
