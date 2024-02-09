use crate::crypto::Bin;
use subtle::ConstantTimeEq;

macro_rules! id_type {
    ($newtype:ident,$basetype:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Eq, Hash, Ord)]
        #[repr(transparent)]
        pub struct $newtype($basetype);

        impl $newtype {
            pub const MIN: $newtype = $newtype(0);
            pub const MAX: $newtype = $newtype($basetype::MAX);

            #[inline(always)]
            pub const fn next(&self) -> Option<$newtype> {
                if self.0 < $basetype::MAX {
                    Some($newtype(self.0 + 1))
                } else {
                    None
                }
            }

            #[inline(always)]
            pub const fn previous(&self) -> Option<$newtype> {
                if self.0 > 0 {
                    Some($newtype(self.0 - 1))
                } else {
                    None
                }
            }
        }

        impl From<$newtype> for usize {
            #[inline]
            fn from(val: $newtype) -> usize {
                val.0 as usize
            }
        }

        impl subtle::ConstantTimeEq for $newtype {
            #[inline]
            fn ct_eq(&self, other: &Self) -> subtle::Choice {
                self.0.ct_eq(&other.0)
            }
        }
    };
}

id_type!(MessageID, u64);

pub mod chain;
pub mod identity;
pub mod question;
pub mod room;
pub mod survey;
