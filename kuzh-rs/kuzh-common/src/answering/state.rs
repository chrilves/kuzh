use curve25519_dalek::RistrettoPoint;
use curve25519_dalek::Scalar;

use crate::common::AnsweringIdentityID;
use crate::common::IdentityID;
use crate::common::Question;
use crate::crypto::{PublicKey, SecretKey};
use crate::newtypes::UserID;
use crate::room::state::RoomError;
use crate::room::state::RoomState;
use crate::room::HasRole;
use std::collections::{HashMap, HashSet};

use super::ClearAnswer;
use super::events::AnsweringEvent;
use super::Answer;

#[derive(Debug, Clone, PartialEq)]
pub struct AnsweringState {
    pub question: Question,
    pub phase: AnsweringPhase,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnsweringMemberPresence {
    Present,
    Absent,
    Kicked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnsweringPhase {
    Open {
        joinable: bool,
        collectable: bool,
        members: HashMap<UserID, UserOpenState>,
        remaining_members: u16
    },
    Answers {
        iteration: u64,
        members: HashMap<UserID, PublicKey>,
        encryption: RistrettoPoint,
        answers: Vec<Answer>,
        remaining_answers: u16
    },
    Decrypt {
        iteration: u64,
        members: HashMap<UserID, UserDecryptState>,
        encryption: RistrettoPoint,
        secret: SecretKey,
        answers: Vec<Answer>,
        remaining_members: u16
    },
    Debate {
        members: HashSet<UserID>,
        answers: Vec<ClearAnswer>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserOpenState {
    pub status: AnsweringMemberPresence,
    pub encryption_share: Option<PublicKey>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserDecryptState {
    pub encryption_share: PublicKey,
    pub secret_share: Option<SecretKey>,
}

impl AnsweringPhase  {
    pub fn normalize(&mut self) {
        use AnsweringPhase::*;
        match self {
            Open {
                collectable,
                members,
                remaining_members,
                ..
            } if *collectable && *remaining_members == 0 => {
                let mut encryption_point: RistrettoPoint = RistrettoPoint::mul_base(&Scalar::ZERO);
                let nb = members.len() as u16;
                let mut new_members = HashMap::with_capacity(nb as usize);

                for (id, info) in members {
                    use AnsweringMemberPresence::*;
                    match (info.status, info.encryption_share) {
                        (Present, Some(pk)) => {
                            if let Some(point) = pk.0.decompress() {
                                encryption_point = encryption_point + point;
                                new_members.insert(*id, pk);
                            }
                        }
                        _ => {}
                    }
                }

                *self = Answers {
                    iteration: 0,
                    members: new_members,
                    encryption: encryption_point,
                    answers: Vec::with_capacity(nb as usize),
                    remaining_answers: nb
                }
            }
            Answers {
                iteration,
                members,
                encryption,
                answers,
                remaining_answers
            } if *remaining_answers == 0 => {
                let nb = members.len() as u16;

                *self = Decrypt {
                    iteration: *iteration,
                    members: members.into_iter().map(|(k,v)| (*k, UserDecryptState{
                        encryption_share: v,
                        secret_share: None
                    })).collect(),
                    encryption: *encryption,
                    secret: SecretKey::ZERO,
                    answers: Vec::with_capacity(nb as usize),
                    remaining_members: nb
                }
            }
            Decrypt {
                iteration,
                members,
                encryption,
                secret,
                answers,
                remaining_members
            } if *remaining_members == 0 => {
                *self = Debate {
                    members: members.keys().into_iter().copied().collect(),
                    answers: answers.into_iter().map(|ans| ans.decrypt(secret)).collect()
                }
            }
            Debate {
                members,
                answers,
            } => { todo!{}}
            _ => Ok(())
        }
    }

}

pub enum AsnweringStateCancel {
    RestoreJoinability(bool),
    RestoreCollectability(bool),
    CancelJoin(UserID),
    CancelLeave {
        user: UserID,


    }
}

impl AnsweringState {

    pub fn apply_event(
        &mut self,
        from: AnsweringIdentityID,
        event: AnsweringEvent,
        room_state: &RoomState,
    ) -> Result<Option<AsnweringStateCancel>, RoomError> {
        use AnsweringEvent::*;
        use AnsweringMemberPresence::*;
        use AnsweringPhase::*;
        use AsnweringStateCancel::*;
        use RoomError::*;
        match event {
            CreateAnswering(_) => Err(AnsweringAlreadyCreated),
            ChangeJoinability(mut b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open {
                        joinable,
                        ..
                    } => {
                        std::mem::swap(joinable, &mut b);
                        Ok(Some(RestoreJoinability(b)))
                    },
                    _ => Err(InvalidAnsweringPhase),
                }
            }
            ChangeCollectability(mut b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open {
                        collectable,
                        ..
                    } => {
                        std::mem::swap(collectable, &mut b);
                        Ok(Some(RestoreCollectability(b)))
                    },
                    _ => Err(InvalidAnsweringPhase),
                }
            }
            // User Management
            Join => {
                let user_id = from.user_id().ok_or(Unauthorized)?;
                user_id.ensure_not_banned(room_state)?;

                match &mut self.phase {
                    Open {
                        joinable,
                        members,
                        nb_not_ready,
                        ..
                    } if *joinable => match members.get(&user_id) {
                        Some(_) => Err(AlreadyJoined),
                        None => {
                            members.insert(
                                user_id,
                                UserOpenState {
                                    status: Present,
                                    encryption_share: None,
                                },
                            );
                            *nb_not_ready += 1;
                            Ok(Some(CancelJoin(user_id)))
                        }
                    },
                    _ => Err(AnsweringUnjoinable),
                }
            }
            Leave => {
                todo!{}
            }
            Connected(id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized)
                }

                todo!{}
            }
            Disconnected(id) => {
                todo! {}
            }
            Kick(id) => {
                todo! {}
            }
            Unkick(id) => {
                todo! {}
            }

            // Admin Management

            Go => {
                todo! {}
            }

            // Anonymous Protocol
            Ready(pk) => {
                todo! {}
            }
            Answer(ans) => {
                todo! {}
            }
            SecretShare(sk) => {
                todo! {}
            }

            // Messages
            Message(_) => {
                todo! {}
            }
            MessageRights(role) => {
                todo! {}
            }
            ExplicitMessageRight { identity, allow } => {
                todo! {}
            }
        }
    }
}
