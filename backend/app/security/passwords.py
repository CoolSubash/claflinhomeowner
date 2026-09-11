from argon2 import PasswordHasher
from argon2 import exceptions as argon2_exceptions

_hasher = PasswordHasher()

# Used to verify against when no user was found, so an unknown email spends
# roughly the same time as a real verification instead of returning early -
# without this, response timing itself would leak whether an email exists.
_DUMMY_HASH = _hasher.hash("dummy-password-for-constant-time-comparison")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
        return True
    except argon2_exceptions.VerifyMismatchError:
        return False
    except argon2_exceptions.VerificationError:
        return False
    except argon2_exceptions.InvalidHash:
        return False


def verify_dummy_password(password: str) -> None:
    """Spend the same time as a real verification when no user was found."""
    try:
        _hasher.verify(_DUMMY_HASH, password)
    except argon2_exceptions.Argon2Error:
        pass
