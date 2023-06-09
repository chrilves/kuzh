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
    pub fn normalize(&self) -> Option<Phase> {
        use Phase::*;
        match self {
            Open {
                collectable,
                members,
                unready_members,
                ..
            } if *collectable && *unready_members == 0 => {
                let mut unready_members: HashSet<UserID> = HashSet::new();

                for (id, info) in members {
                    use MemberPresence::*;
                    if let OpenStatus {
                        status: Present,
                        ready: true,
                    } = info
                    {
                        unready_members.insert(*id);
                    }
                }
                Some(Encrypt {
                    iteration: 0,
                    ready_members: HashMap::with_capacity(members.len()),
                    unready_members,
                })
            }
            Encrypt {
                iteration,
                ready_members,
                unready_members,
            } if unready_members.is_empty() => {
                let nb = ready_members.len();
                Some(Answers {
                    iteration: *iteration,
                    members: ready_members.clone(),
                    encryption: ready_members.values().sum(),
                    answers: Vec::with_capacity(nb),
                    remaining_answers: nb as u16,
                })
            }
            Answers {
                iteration,
                members,
                answers,
                remaining_answers,
                ..
            } if *remaining_answers == 0 => Some(Decrypt {
                iteration: *iteration,
                ready_members: HashMap::with_capacity(members.len()),
                answers: answers.clone(),
                unready_members: members.clone(),
            }),
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
                Some(Debate {
                    members: ready_members.keys().copied().collect(),
                    answers: answers.iter().map(|ans| ans.decrypt(secret)).collect(),
                })
            }
            _ => None,
        }
    }

    pub fn next_iteration(&self) -> Option<Phase> {
        use Phase::*;
        match self {
            Encrypt {
                iteration,
                ready_members,
                unready_members,
            } => {
                let mut unready = unready_members.clone();
                for id in ready_members.keys() {
                    unready.insert(*id);
                }

                Some(Encrypt {
                    iteration: *iteration + 1,
                    ready_members: HashMap::with_capacity(
                        ready_members.len() + unready_members.len(),
                    ),
                    unready_members: unready,
                })
            }
            Answers {
                iteration, members, ..
            } => Some(Encrypt {
                iteration: *iteration + 1,
                ready_members: HashMap::with_capacity(members.len()),
                unready_members: members.keys().copied().collect(),
            }),
            Decrypt {
                iteration,
                ready_members,
                unready_members,
                ..
            } => {
                let mut members: HashSet<UserID> =
                    HashSet::with_capacity(unready_members.len() + ready_members.len());
                for id in ready_members.keys() {
                    members.insert(*id);
                }
                for id in unready_members.keys() {
                    members.insert(*id);
                }
                Some(Encrypt {
                    iteration: *iteration + 1,
                    ready_members: HashMap::with_capacity(members.len()),
                    unready_members: members,
                })
            }
            _ => None,
        }
    }
}

pub enum AsnweringStateCancel {
    RestoreJoinability(bool),
    RestoreCollectability(bool),
    CancelJoin(UserID),
    CancelLeaveOpen {
        user: UserID,
        open_status: OpenStatus,
        phase: Option<Box<Phase>>,
    },
    CancelLeaveDebate(UserID),
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
                let user_id = from.user_id().ok_or(Unauthorized)?;

                match &mut self.phase {
                    Open {
                        members,
                        unready_members,
                        ..
                    } => match members.get(&user_id) {
                        Some(OpenStatus {
                            status: Present,
                            ready,
                        }) => {
                            if !ready {
                                *unready_members -= 1;
                            }
                            match members.remove(&user_id) {
                                Some(v) => {
                                    let new_phase = self
                                        .phase
                                        .normalize()
                                        .map(|p| Box::new(std::mem::replace(&mut self.phase, p)));

                                    Ok(Some(CancelLeaveOpen {
                                        user: user_id,
                                        open_status: v,
                                        phase: new_phase,
                                    }))
                                }
                                None => Err(NoSuchUser),
                            }
                        }
                        Some(_) => Err(Unauthorized),
                        None => Err(NoSuchUser),
                    },
                    Phase::Debate { members, .. } => {
                        if members.contains(&user_id) {
                            members.remove(&user_id);
                            Ok(Some(CancelLeaveDebate(user_id)))
                        } else {
                            Err(NoSuchUser)
                        }
                    }
                    Phase::Encrypt { .. } => {
                        todo! {}
                    }
                    Phase::Answers { .. } => {
                        todo! {}
                    }
                    Phase::Decrypt { .. } => {
                        todo! {}
                    }
                }
            }
            Connected(_id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized);
                }

                todo! {}
            }
            Disconnected(_id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized);
                }

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
