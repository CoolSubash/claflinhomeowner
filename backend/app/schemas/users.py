from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserCountResponse(BaseModel):
    count: int


class UserPublic(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool
    email_verified: bool
    created_at: datetime


class UserWithRoles(UserPublic):
    """UserPublic plus the caller's roles - used by GET /auth/me (so the
    frontend can decide whether to show admin/realtor navigation) and by
    the admin user list. Never includes permissions - roles are a stable,
    small, presentational list; permissions are re-resolved from the
    database on every authorization decision instead (docs/authorization.md)."""

    roles: list[str]
