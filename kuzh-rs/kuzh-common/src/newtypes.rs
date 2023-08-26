use subtle::ConstantTimeEq;

pub mod user_id {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
    #[repr(transparent)]
    pub struct UserID(u16);

    impl UserID {
        pub const MIN: UserID = UserID(0);
        pub const MAX: UserID = UserID(u16::MAX);

        #[inline(always)]
        pub const fn next(&self) -> Option<UserID> {
            if self.0 < u16::MAX {
                Some(UserID(self.0 + 1))
            } else {
                None
            }
        }

        #[inline(always)]
        pub const fn previous(&self) -> Option<UserID> {
            if self.0 > 0 {
                Some(UserID(self.0 - 1))
            } else {
                None
            }
        }
    }

    impl From<UserID> for usize {
        #[inline]
        fn from(val: UserID) -> usize {
            val.0 as usize
        }
    }

    impl ConstantTimeEq for UserID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod mask_id {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
    #[repr(transparent)]
    pub struct MaskID(u32);

    impl MaskID {
        pub const MIN: MaskID = MaskID(0);
        pub const MAX: MaskID = MaskID(u32::MAX);

        #[inline(always)]
        pub const fn next(&self) -> Option<MaskID> {
            if self.0 < u32::MAX {
                Some(MaskID(self.0 + 1))
            } else {
                None
            }
        }

        #[inline(always)]
        pub const fn previous(&self) -> Option<MaskID> {
            if self.0 > 0 {
                Some(MaskID(self.0 - 1))
            } else {
                None
            }
        }
    }

    impl From<MaskID> for usize {
        #[inline]
        fn from(val: MaskID) -> usize {
            val.0 as usize
        }
    }

    impl ConstantTimeEq for MaskID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod question_id {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
    #[repr(transparent)]
    pub struct QuestionID(u16);

    impl QuestionID {
        pub const MIN: QuestionID = QuestionID(0);
        pub const MAX: QuestionID = QuestionID(u16::MAX);

        #[inline(always)]
        pub const fn next(&self) -> Option<QuestionID> {
            if self.0 < u16::MAX {
                Some(QuestionID(self.0 + 1))
            } else {
                None
            }
        }

        #[inline(always)]
        pub const fn previous(&self) -> Option<QuestionID> {
            if self.0 > 0 {
                Some(QuestionID(self.0 - 1))
            } else {
                None
            }
        }
    }

    impl From<QuestionID> for usize {
        #[inline]
        fn from(val: QuestionID) -> usize {
            val.0 as usize
        }
    }

    impl ConstantTimeEq for QuestionID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod answer_id {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct AnswerID(u16);

    impl AnswerID {
        pub const MIN: AnswerID = AnswerID(0);
        pub const MAX: AnswerID = AnswerID(u16::MAX);

        #[inline(always)]
        pub const fn next(&self) -> Option<AnswerID> {
            if self.0 < u16::MAX {
                Some(AnswerID(self.0 + 1))
            } else {
                None
            }
        }

        #[inline(always)]
        pub const fn previous(&self) -> Option<AnswerID> {
            if self.0 > 0 {
                Some(AnswerID(self.0 - 1))
            } else {
                None
            }
        }
    }

    impl From<AnswerID> for usize {
        #[inline]
        fn from(val: AnswerID) -> usize {
            val.0 as usize
        }
    }

    impl ConstantTimeEq for AnswerID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod message_id {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct MessageID(u64);

    impl ConstantTimeEq for MessageID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod hashed {
    use super::*;
    use crate::crypto::Bin;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct Hashed(Bin);

    impl ConstantTimeEq for Hashed {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod nonce {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct Nonce(u64);

    impl Nonce {
        #[inline]
        pub fn new() -> Nonce {
            Nonce(0)
        }

        #[inline]
        pub fn next(self) -> Nonce {
            Nonce(self.0 + 1)
        }
    }

    impl Default for Nonce {
        fn default() -> Self {
            Self::new()
        }
    }

    impl ConstantTimeEq for Nonce {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod block_height {
    use std::marker::PhantomData;

    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct BlockHeight<Event> {
        height: u64,
        _marker: PhantomData<Event>,
    }

    impl<Event> ConstantTimeEq for BlockHeight<Event> {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.height.ct_eq(&other.height)
        }
    }
}

pub use answer_id::*;
pub use block_height::*;
pub use hashed::*;
pub use mask_id::*;
pub use message_id::*;
pub use nonce::*;
pub use question_id::*;
pub use user_id::*;
