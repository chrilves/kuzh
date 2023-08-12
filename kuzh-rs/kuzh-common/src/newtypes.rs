use subtle::ConstantTimeEq;

pub mod user_id {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
    #[repr(transparent)]
    pub struct UserID(u16);

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

    impl ConstantTimeEq for MaskID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod question_id {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct QuestionID(u16);

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

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct Nonce(u64);

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
