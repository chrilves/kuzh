
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
        present: HashSet<UserID>,
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
    Disconnected,
    Kicked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum RemovalReason {
    Left,
    Deconnected,
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
                *self = Encrypt {
                    iteration: 0,
                    ready_members: HashMap::with_capacity(unready_members.len()),
                    unready_members,
                };
            }
            Encrypt {
                iteration,
                ready_members,
                unready_members,
            } if unready_members.is_empty() => {
                let nb = ready_members.len();
                let members = std::mem::replace(ready_members, HashMap::with_capacity(0));
                let encryption = members.values().sum();
                *self = Answers {
                    iteration: *iteration,
                    members,
                    encryption,
                    answers: Vec::with_capacity(nb),
                    remaining_answers: nb as u16,
                };
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
                };
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
                let members: HashSet<UserID> = ready_members.keys().copied().collect();
                *self = Debate {
                    members: members.clone(),
                    present: members,
                    answers: answers.iter().map(|ans| ans.decrypt(secret)).collect(),
                };
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
                for id in ready_members.keys() {
                    unready_members.insert(*id);
                }
                *iteration += 1;
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
                };
            }
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

    pub fn remove_user(&mut self, user_id: UserID, reason: RemovalReason) -> Result<(), RoomError> {
        use MemberPresence::*;
        use Phase::*;
        use RoomError::*;
        match self {
            Open {
                members,
                unready_members,
                ..
            } => match members.get(&user_id) {
                Some(OpenStatus { status, ready }) => {
                    let user_info = members.get_mut(&user_id).ok_or(NoSuchUser)?;

                    match reason {
                        RemovalReason::Deconnected => {
                            if *status != Present {
                                return Err(Unauthorized);
                            }
                        }
                        _ => {
                            if *status == Kicked {
                                return Err(Unauthorized);
                            }
                        }
                    }

                    if *status == Present && !ready {
                        *unready_members -= 1;
                    }

                    match reason {
                        RemovalReason::Left => {
                            members.remove(&user_id);
                        }
                        RemovalReason::Deconnected => {
                            user_info.status = MemberPresence::Disconnected;
                        }
                        RemovalReason::Kicked => {
                            user_info.status = MemberPresence::Kicked;
                        }
                    }
                    self.normalize();
                    Ok(())
                }
                None => Err(NoSuchUser),
            },
            Phase::Debate { members, .. } => {
                if members.contains(&user_id) {
                    members.remove(&user_id);
                    Ok(())
                } else {
                    Err(NoSuchUser)
                }
            }
            Phase::Encrypt {
                ready_members,
                unready_members,
                ..
            } => {
                if unready_members.contains(&user_id) {
                    unready_members.remove(&user_id);
                    self.normalize();
                    return Ok(());
                }
                if ready_members.contains_key(&user_id) {
                    ready_members.remove(&user_id);
                    self.normalize();
                    return Ok(());
                }
                Err(NoSuchUser)
            }
            Phase::Answers { members, .. } => {
                if members.contains_key(&user_id) {
                    members.remove(&user_id);
                    self.next_iteration();
                    Ok(())
                } else {
                    Err(NoSuchUser)
                }
            }
            Phase::Decrypt {
                unready_members,
                ready_members,
                ..
            } => {
                if unready_members.contains_key(&user_id) {
                    unready_members.remove(&user_id);
                    self.next_iteration();
                    return Ok(());
                }
                if ready_members.contains_key(&user_id) {
                    ready_members.remove(&user_id);
                    self.next_iteration();
                    return Ok(());
                }
                Err(NoSuchUser)
            }
        }
    }
}

impl AnsweringState {
    pub fn apply_event(
        &mut self,
        from: AnsweringIdentityID,
        event: AnsweringEvent,
        room_state: &RoomState,
    ) -> Result<(), RoomError> {
        use AnsweringEvent::*;
        use MemberPresence::*;
        use Phase::*;
        use RoomError::*;
        match event {
            CreateAnswering(_) => Err(AnsweringAlreadyCreated),
            SetJoinability(b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open { joinable, .. } => {
                        *joinable = b;
                        Ok(())
                    }
                    _ => Err(InvalidAnsweringPhase),
                }
            }
            SetCollectability(b) => {
                from.ensure_admin_or_moderator(room_state)?;
                match &mut self.phase {
                    Open { collectable, .. } => {
                        *collectable = b;
                        Ok(())
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
                            Ok(())
                        }
                    },
                    _ => Err(AnsweringUnjoinable),
                }
            }
            Leave => {
                let user_id = from.user_id().ok_or(Unauthorized)?;
                self.phase.remove_user(user_id, RemovalReason::Left)
            }
            Connected(user_id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized);
                }

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
                            if members.remove(&user_id).is_some() {
                                self.phase.normalize();
                                Ok(())
                            } else {
                                Err(NoSuchUser)
                            }
                        }
                        Some(_) => Err(Unauthorized),
                        None => Err(NoSuchUser),
                    },
                    Phase::Debate { members, .. } => {
                        if members.contains(&user_id) {
                            members.remove(&user_id);
                            Ok(())
                        } else {
                            Err(NoSuchUser)
                        }
                    }
                    _ => Err(ConnectionRefused),
                }
            }
            AnsweringEvent::Disconnected(user_id) => {
                if from != IdentityID::RoomID {
                    return Err(Unauthorized);
                }
                self.phase.remove_user(user_id, RemovalReason::Deconnected)
            }
            Kick(user_id) => {
                from.ensure_admin_or_moderator(room_state)?;
                self.phase.remove_user(user_id, RemovalReason::Kicked)
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
        }
    }
}
