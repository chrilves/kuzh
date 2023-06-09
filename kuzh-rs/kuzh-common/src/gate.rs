use subtle::ConstantTimeEq;

pub mod user {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct User(u16);

    impl ConstantTimeEq for User {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod quetion_id {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct QuestionID(u64);

    impl ConstantTimeEq for QuestionID {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod hashed {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct Hashed();

    impl ConstantTimeEq for Hashed {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            subtle::Choice::from(1)
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

pub use hashed::*;
pub use nonce::*;
pub use quetion_id::*;
pub use user::*;
