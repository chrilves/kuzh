use std::array::TryFromSliceError;

use curve25519_dalek::ristretto::*;
use curve25519_dalek::Scalar;
use rand::rngs::OsRng;
use subtle::ConstantTimeEq;
use thiserror::Error;

pub const CRYPTO_BIN_SIZE: usize = 32;
pub type Bin = [u8; CRYPTO_BIN_SIZE];

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Random process failed")]
    RandError(#[from] rand::Error),
    #[error("Wrong slice size")]
    TryFromSlice(#[from] TryFromSliceError),
}

pub mod public_key {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    #[repr(transparent)]
    pub struct PublicKey(pub(crate) CompressedRistretto);

    impl PublicKey {
        #[inline]
        pub fn to_bytes(&self) -> Bin {
            self.0.to_bytes()
        }

        #[inline]
        pub fn as_bytes(&self) -> &Bin {
            self.0.as_bytes()
        }

        pub fn verify(&self, message: &[u8], sig: Sig) -> Option<bool> {
            let r = (RistrettoPoint::mul_base(&sig.a)) + (sig.c * self.0.decompress()?);
            let mut hasher = blake3::Hasher::new();
            hasher.update(r.compress().as_bytes());
            hasher.update(message);
            let c2 = Scalar::from_bytes_mod_order(*hasher.finalize().as_bytes());
            Some(sig.c == c2)
        }
    }

    impl From<&SecretKey> for PublicKey {
        #[inline]
        fn from(value: &SecretKey) -> Self {
            PublicKey(RistrettoPoint::mul_base(&value.0).compress())
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
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    #[repr(transparent)]
    pub struct SecretKey(pub(crate) Scalar);

    impl SecretKey {
        pub const ZERO: SecretKey = SecretKey(Scalar::ZERO);

        /// Get a true random SecretKey (via OsRng)
        #[inline]
        pub fn random() -> SecretKey {
            SecretKey(Scalar::random(&mut OsRng))
        }

        #[inline]
        pub fn to_bytes(&self) -> Bin {
            self.0.to_bytes()
        }

        #[inline]
        pub fn public_key(&self) -> PublicKey {
            PublicKey(RistrettoPoint::mul_base(&self.0).compress())
        }

        pub fn sign(&self, message: &[u8]) -> Sig {
            let r = Scalar::random(&mut OsRng);
            let rp = RistrettoPoint::mul_base(&r);
            let mut hasher = blake3::Hasher::new();
            hasher.update(rp.compress().as_bytes());
            hasher.update(message);
            let c = Scalar::from_bytes_mod_order(*hasher.finalize().as_bytes());
            Sig {
                c,
                a: r - c * self.0,
            }
        }
    }

    impl ConstantTimeEq for SecretKey {
        #[inline]
        fn ct_eq(&self, other: &Self) -> subtle::Choice {
            self.0.ct_eq(&other.0)
        }
    }

    impl<'a, 'b> Mul<&'b PublicKey> for &'a SecretKey {
        type Output = Option<PublicKey>;
        #[inline]
        fn mul(self, _rhs: &'b PublicKey) -> Option<PublicKey> {
            Some(PublicKey((self.0 * _rhs.0.decompress()?).compress()))
        }
    }
}

pub mod sig {
    use super::*;

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    pub struct Sig {
        pub c: Scalar,
        pub a: Scalar,
    }
}

pub mod ring_sig {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct RingSig {
        a1: CompressedRistretto,
        c: Vec<Scalar>,
        z: Vec<Scalar>,
    }

    #[derive(Debug)]
    pub enum Link {
        Independent,
        SamePublicKey(usize),
        SameMessage,
    }

    impl RingSig {
        fn compute_h(tag: &[u8], public_keys: &[PublicKey]) -> RistrettoPoint {
            let mut hasher = blake3::Hasher::new();
            hasher.update(b"h");
            hasher.update(tag);
            for key in public_keys {
                hasher.update(&key.to_bytes());
            }
            let mut hash_tag = [0u8; 64];
            hasher.finalize_xof().fill(&mut hash_tag);
            RistrettoPoint::from_uniform_bytes(&hash_tag)
        }

        fn compute_a0(tag: &[u8], public_keys: &[PublicKey], message: &[u8]) -> RistrettoPoint {
            let mut hasher = blake3::Hasher::new();
            hasher.update(b"a0");
            hasher.update(tag);
            for key in public_keys {
                hasher.update(&key.to_bytes());
            }
            hasher.update(message);
            let mut hash_tag = [0u8; 64];
            hasher.finalize_xof().fill(&mut hash_tag);
            RistrettoPoint::from_uniform_bytes(&hash_tag)
        }

        fn compute_c(
            tag: &[u8],
            public_keys: &[PublicKey],
            big_a0: &RistrettoPoint,
            big_a1: &RistrettoPoint,
            a: &[RistrettoPoint],
            b: &[RistrettoPoint],
        ) -> Scalar {
            let mut hasher = blake3::Hasher::new();
            hasher.update(b"c");
            hasher.update(tag);
            for key in public_keys {
                hasher.update(&key.to_bytes());
            }
            hasher.update(&big_a0.compress().to_bytes());
            hasher.update(&big_a1.compress().to_bytes());
            for an in a {
                hasher.update(an.compress().as_bytes());
            }
            for bn in b {
                hasher.update(bn.compress().as_bytes());
            }
            Scalar::from_bytes_mod_order(*hasher.finalize().as_bytes())
        }

        pub fn sign(
            tag: &[u8],
            public_keys: &[PublicKey],
            message: &[u8],
            secret: SecretKey,
            index: usize,
        ) -> Result<RingSig, String> {
            let nb_keys = public_keys.len();
            if index >= nb_keys {
                return Err(String::from("RingSig::sign: index bigger than keys"));
            }
            if secret.public_key() != public_keys[index] {
                return Err(String::from(
                    "RingSig::sign: the secret key does not match the public key",
                ));
            }
            let h = Self::compute_h(tag, public_keys);
            let sigma_i = secret.0 * h;
            let big_a0 = Self::compute_a0(tag, public_keys, message);
            let big_a1 = Scalar::from((index + 1) as u64).invert() * (sigma_i - big_a0);

            let mut sigmas = Vec::new();
            for j in 0..nb_keys {
                sigmas.push(if j == index {
                    sigma_i
                } else {
                    big_a0 + Scalar::from((j + 1) as u64) * big_a1
                });
            }

            let mut a = Vec::new();
            let mut b = Vec::new();
            let mut c = Vec::new();
            let mut z = Vec::new();
            let mut other_c = Scalar::ZERO;
            let wi = Scalar::random(&mut OsRng);
            for j in 0..nb_keys {
                if j != index {
                    let zj = Scalar::random(&mut OsRng);
                    let cj = Scalar::random(&mut OsRng);
                    other_c += cj;
                    c.push(cj);
                    z.push(zj);
                    a.push(
                        RistrettoPoint::mul_base(&zj)
                            + cj * public_keys[j].0.decompress().ok_or(format!(
                                "RingSig::sign: invalid public_keys[{:?}]: {:?}",
                                j, public_keys[j]
                            ))?,
                    );
                    b.push(zj * h + cj * sigmas[j]);
                } else {
                    a.push(RistrettoPoint::mul_base(&wi));
                    b.push(wi * h);
                    z.push(Scalar::ZERO);
                    c.push(Scalar::ZERO);
                }
            }

            let ci = Self::compute_c(tag, public_keys, &big_a0, &big_a1, &a, &b) - other_c;
            z[index] = wi - (ci * secret.0);
            c[index] = ci;

            Ok(RingSig {
                a1: big_a1.compress(),
                c,
                z,
            })
        }

        pub fn verify(
            &self,
            tag: &[u8],
            public_keys: &[PublicKey],
            message: &[u8],
        ) -> Result<bool, String> {
            let nb_keys = public_keys.len();
            if self.c.len() != nb_keys {
                return Err(String::from("RingSig::verify: size of c do not match keys"));
            }
            if self.z.len() != nb_keys {
                return Err(String::from("RingSig::verify: size of z do not match keys"));
            }
            let big_a1 = self
                .a1
                .decompress()
                .ok_or(String::from("RingSig::verify: a1 decompression failed"))?;
            let big_a0 = Self::compute_a0(tag, public_keys, message);
            let h = Self::compute_h(tag, public_keys);

            let mut a = Vec::new();
            let mut b = Vec::new();
            for (j, pk) in public_keys.iter().enumerate() {
                a.push(
                    RistrettoPoint::mul_base(&self.z[j])
                        + self.c[j]
                            * pk.0.decompress().ok_or(format!(
                                "RingSig::sign: invalid public_keys[{:?}]: {:?}",
                                j, public_keys[j]
                            ))?,
                );
                let sigma = big_a0 + Scalar::from((j + 1) as u64) * big_a1;
                b.push(self.z[j] * h + self.c[j] * sigma);
            }

            Ok(Self::compute_c(tag, public_keys, &big_a0, &big_a1, &a, &b) == self.c.iter().sum())
        }

        pub fn link(
            tag: &[u8],
            public_keys: &[PublicKey],
            message1: &[u8],
            sig1: &RingSig,
            message2: &[u8],
            sig2: &RingSig,
        ) -> Result<Link, String> {
            let nb_keys = public_keys.len();
            if nb_keys == 0 {
                return Err(String::from("RingSig::trace: no public keys"));
            }
            if sig1.c.len() != nb_keys {
                return Err(String::from(
                    "RingSig::trace: size of sig1.c do not match keys",
                ));
            }
            if sig1.z.len() != nb_keys {
                return Err(String::from(
                    "RingSig::trace: size of sig1.z do not match keys",
                ));
            }
            if sig2.c.len() != nb_keys {
                return Err(String::from(
                    "RingSig::trace: size of sig2.c do not match keys",
                ));
            }
            if sig2.z.len() != nb_keys {
                return Err(String::from(
                    "RingSig::trace: size of sig2.z do not match keys",
                ));
            }
            if nb_keys == 1 {
                return Ok(Link::SamePublicKey(0));
            }
            let big_a0_1 = Self::compute_a0(tag, public_keys, message1);
            let big_a0_2 = Self::compute_a0(tag, public_keys, message2);

            let big_a1_1 = sig1
                .a1
                .decompress()
                .ok_or(String::from("RingSig::trace: sig1.a1 decompression failed"))?;
            let big_a1_2 = sig2
                .a1
                .decompress()
                .ok_or(String::from("RingSig::trace: sig2.a1 decompression failed"))?;

            let mut seen_diff = false;
            let mut nb_eq: usize = 0;
            let mut last_eq: usize = 0;

            for j in 0..nb_keys {
                let sigma_1 = big_a0_1 + Scalar::from((j + 1) as u64) * big_a1_1;
                let sigma_2 = big_a0_2 + Scalar::from((j + 1) as u64) * big_a1_2;

                if sigma_1 == sigma_2 {
                    nb_eq += 1;
                    last_eq = j;
                } else {
                    seen_diff = true;
                }

                if seen_diff && nb_eq > 1 {
                    return Ok(Link::Independent);
                }
            }

            Ok(if seen_diff {
                if nb_eq == 1 {
                    Link::SamePublicKey(last_eq)
                } else {
                    Link::Independent
                }
            } else {
                Link::SameMessage
            })
        }
    }
}

pub use public_key::*;
pub use ring_sig::*;
pub use secret_key::*;
pub use sig::*;
