use crate::common::AnsweringIdentityID;
use crate::common::IdentityID;
use crate::common::Question;
use crate::crypto::{PublicKey, SecretKey};
use crate::newtypes::UserID;
use crate::room::state::RoomError;
use crate::room::state::RoomState;
use crate::room::HasRole;
use std::collections::{HashMap, HashSet};

use super::events::AnsweringEvent;
use super::Answer;
use super::ClearAnswer;

#[derive(Debug, Clone, PartialEq)]
pub struct AnsweringState {
    pub question: Question,
    pub phase: Phase,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Phase {
    Open {
        joinable: bool,
        collectable: bool,
        members: HashMap<UserID, OpenStatus>,
        unready_members: u16,
    },
    Encrypt {
        iteration: u64,
        ready_members: HashMap<UserID, PublicKey>,
        unready_members: HashSet<UserID>,
    },
    Answers {
        iteration: u64,
        members: HashMap<UserID, PublicKey>,
        encryption: PublicKey,
        answers: Vec<Answer>,
        remaining_answers: u16,
    },
    Decrypt {
        iteration: u64,
        ready_members: HashMap<UserID, DecryptStatus>,
        answers: Vec<Answer>,
        unready_members: HashMap<UserID, PublicKey>,
    },
    Debate {
        members: HashSet<UserID>,
        answers: Vec<ClearAnswer>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenStatus {
    pub status: MemberPresence,
    pub ready: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MemberPresence {
    Present,
    Absent,
    Kicked,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DecryptStatus {
    pub public_key: PublicKey,
    pub secret_key: SecretKey,
}

impl Phase {
    pub fn normalize(&mut self) {
        use Phase::*;
        match self {
            Open {
                collectable,
                members,
                unready_members,
                ..
            } if *collectable && *unready_members == 0 => {
                let mut unready_members: HashSet<UserID> = HashSet::new();

                for (id, info) in std::mem::replace(members, HashMap::with_capacity(0)) {
                    use MemberPresence::*;
                    if let OpenStatus {
                        status: Present,
                        ready: true,
                    } = info
                    {
                        unready_members.insert(id);
                    }
                }

                *self = Encrypt {
                    iteration: 0,
                    ready_members: HashMap::with_capacity(members.len()),
                    unready_members,
                }
            }
            Encrypt {
                iteration,
                ready_members,
                unready_members,
            } if unready_members.is_empty() => {
                let nb = ready_members.len();
                *self = Answers {
                    iteration: *iteration,
                    members: std::mem::replace(ready_members, HashMap::with_capacity(0)),
                    encryption: ready_members.values().sum(),
                    answers: Vec::with_capacity(nb),
                    remaining_answers: nb as u16,
                }
            }
            Answers {
                iteration,
                members,
                answers,
                remaining_answers,
                ..
            } if *remaining_answers == 0 => {
                *self = Decrypt {
                    iteration: *iteration,
                    ready_members: HashMap::with_capacity(members.len()),
                    answers: std::mem::replace(answers, Vec::with_capacity(0)),
                    unready_members: std::mem::replace(members, HashMap::with_capacity(0)),
                }
            }
            Decrypt {
                ready_members,
                answers,
                unready_members,
                ..
            } if unready_members.is_empty() => {
                let secret = ready_members
                    .values()
                    .map(|v| v.secret_key)
                    .sum::<SecretKey>();
                *self = Debate {
                    members: ready_members.keys().copied().collect(),
                    answers: answers.iter_mut().map(|ans| ans.decrypt(secret)).collect(),
                }
            }
            Debate {
                members: _,
                answers: _,
            } => {
                todo! {}
            }
            _ => {}
        }
    }

    pub fn next_iteration(&mut self) {
        use Phase::*;
        match self {
            Encrypt {
                iteration,
                ready_members,
                unready_members,
            } => {
                *iteration += 1;
                ready_members.keys().for_each(|k| {
                    unready_members.insert(*k);
                });
                ready_members.clear();
            }
            Answers {
                iteration, members, ..
            } => {
                let unready_members: HashSet<UserID> = members.keys().copied().collect();
                members.clear();

                *self = Encrypt {
                    iteration: *iteration + 1,
                    ready_members: std::mem::replace(members, HashMap::with_capacity(0)),
                    unready_members,
                }
            }
            Decrypt {
                iteration,
                ready_members,
                unready_members,
                ..
            } => {
                let mut members: HashSet<UserID> =
                    HashSet::with_capacity(unready_members.len() + ready_members.len());
                for (id, _) in std::mem::replace(ready_members, HashMap::with_capacity(0)) {
                    members.insert(id);
                }
                for id in unready_members.keys() {
                    members.insert(*id);
                }

                unready_members.clear();

                *self = Encrypt {
                    iteration: *iteration + 1,
                    ready_members: std::mem::replace(unready_members, HashMap::with_capacity(0)),
                    unready_members: members,
                }
            }
            _ => {}
        }
    }
}

pub enum AsnweringStateCancel {
    RestoreJoinability(bool),
    RestoreCollectability(bool),
    CancelJoin(UserID),
    CancelLeave { user: UserID },
}

impl AnsweringState {
    pub fn apply_event(
        &mut self,
        from: AnsweringIdentityID,
        event: AnsweringEvent,
        room_state: &RoomState,
    ) -> Result<Option<AsnweringStateCancel>, RoomError> {
        use AnsweringEvent::*;
        use AsnweringStateCancel::*;
        use MemberPresence::*;
        use Phase::*;
        use RoomError::*;
        match event {
            CreateAnswering(_) => Err(AnsweringAlreadyCreated),
            ChangeJoinability(mut b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open { joinable, .. } => {
                        std::mem::swap(joinable, &mut b);
                        Ok(Some(RestoreJoinability(b)))
                    }
                    _ => Err(InvalidAnsweringPhase),
                }
            }
            ChangeCollectability(mut b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open { collectable, .. } => {
                        std::mem::swap(collectable, &mut b);
                        Ok(Some(RestoreCollectability(b)))
                    }
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
                        unready_members,
                        ..
                    } if *joinable => match members.get(&user_id) {
                        Some(_) => Err(AlreadyJoined),
                        None => {
                            members.insert(
                                user_id,
                                OpenStatus {
                                    status: Present,
                                    ready: false,
                                },
                            );
                            *unready_members += 1;
                            Ok(Some(CancelJoin(user_id)))
                        }
                    },
                    _ => Err(AnsweringUnjoinable),
                }
            }
            Leave => {
                todo! {}
            }
            Connected(_id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized);
                }

                todo! {}
            }
            Disconnected(_id) => {
                todo! {}
            }
            Kick(_id) => {
                todo! {}
            }
            Unkick(_id) => {
                todo! {}
            }

            // Admin Management
            Go => {
                todo! {}
            }

            // Anonymous Protocol
            Ready => {
                todo! {}
            }
            AnsweringEvent::Encrypt {
                public_key: _,
                challenge: _,
            } => {
                todo! {}
            }
            AnsweringEvent::Answers(_ans) => {
                todo! {}
            }
            Decrypt(_sk) => {
                todo! {}
            }

            // Messages
            Message(_) => {
                todo! {}
            }
            MessageRights(_role) => {
                todo! {}
            }
            ExplicitMessageRight {
                identity: _,
                allow: _,
            } => {
                todo! {}
            }
        }
    }
}
