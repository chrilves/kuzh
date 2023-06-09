use std::array::TryFromSliceError;

use curve25519_dalek::constants::RISTRETTO_BASEPOINT_TABLE;
use curve25519_dalek::ristretto::*;
use curve25519_dalek::Scalar;
use rand::rngs::OsRng;
use subtle::ConstantTimeEq;
use thiserror::Error;

type Bin = [u8; 32];

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Random process failed")]
    RandError(#[from] rand::Error),
    #[error("Wrong slice size")]
    TryFromSlice(#[from] TryFromSliceError),
}

pub mod public_key {
    use super::*;

    #[derive(Clone, Copy, PartialEq, Eq)]
    #[repr(transparent)]
    pub struct PublicKey(pub(crate) RistrettoPoint);

    impl PublicKey {
        #[inline]
        pub fn to_bytes(&self) -> Bin {
            self.0.compress().to_bytes()
        }
    }

    impl From<&SecretKey> for PublicKey {
        #[inline]
        fn from(value: &SecretKey) -> Self {
            PublicKey(&value.0 * RISTRETTO_BASEPOINT_TABLE)
        }
    }

    impl ConstantTimeEq for PublicKey {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }
}

pub mod secret_key {
    use std::ops::Mul;

    use super::*;
    #[derive(Clone, Copy, PartialEq, Eq, Hash)]
    #[repr(transparent)]
    pub struct SecretKey(pub(crate) Scalar);

    impl SecretKey {
        /// Get a true random SecretKey (via OsRng)
        #[inline]
        pub fn random() -> SecretKey {
            SecretKey(Scalar::random(&mut OsRng))
        }

        #[inline]
        pub fn to_bytes(&self) -> Bin {
            self.0.to_bytes()
        }
    }

    impl ConstantTimeEq for SecretKey {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }

    impl<'a, 'b> Mul<&'b PublicKey> for &'a SecretKey {
        type Output = PublicKey;
        #[inline]
        fn mul(self, _rhs: &'b PublicKey) -> PublicKey {
            PublicKey(self.0 * _rhs.0)
        }
    }
}

pub mod sig {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct Sig {}

    impl ConstantTimeEq for Sig {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            subtle::Choice::from(1)
        }
    }
}

pub mod ring_sig {
    use super::*;

    #[derive(Clone, Copy, PartialEq, PartialOrd, Eq, Hash)]
    #[repr(transparent)]
    pub struct RingSig {}

    impl ConstantTimeEq for RingSig {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            subtle::Choice::from(1)
        }
    }
}

pub use public_key::*;
pub use ring_sig::*;
pub use secret_key::*;
pub use sig::*;
