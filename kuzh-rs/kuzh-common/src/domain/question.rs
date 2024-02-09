use super::room::RoomIdentityID;

id_type!(QuestionID, u16);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum QuestionKind {
    Open,
    Closed,
    Poll(Vec<String>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Question {
    pub id: QuestionID,
    pub from: RoomIdentityID,
    pub kind: QuestionKind,
    pub question: String,
    pub clarifications: Vec<String>,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum QuestionPriority {
    Bottom,
    Low,
    Standard,
    Hight,
    Top,
}

impl PartialOrd for QuestionPriority {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QuestionPriority {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        fn to_u8(p: &QuestionPriority) -> u8 {
            use QuestionPriority::*;
            match p {
                Bottom => 0,
                Low => 1,
                Standard => 2,
                Hight => 3,
                Top => 4,
            }
        }

        to_u8(self).cmp(&to_u8(other))
    }
}
