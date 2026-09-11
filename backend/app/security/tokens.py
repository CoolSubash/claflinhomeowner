from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings


class TokenError(Exception):
    """Raised for any invalid, expired, or malformed access token."""


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    settings = get_settings()
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")

    now = datetime.now(timezone.utc)
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")

    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


def generate_secure_token() -> str:
    # 384 bits of entropy from the OS CSPRNG - plenty to treat as
    # unguessable, and independent of the JWT signing secret. Shared by
    # every opaque-random-token flow in this app (refresh tokens, email
    # verification tokens) rather than each rolling its own generator.
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    # SHA-256, not Argon2id: these tokens are already high-entropy random
    # values (unlike a user password), so lookup needs a fast, collision-
    # resistant hash rather than a deliberately slow KDF - hashing every
    # lookup with Argon2 would also make it a cheap DoS vector under load.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return generate_secure_token()


def hash_refresh_token(token: str) -> str:
    return hash_token(token)
