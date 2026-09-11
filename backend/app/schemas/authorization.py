from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class AuthorizationContext(BaseModel):
    """
    What a request is allowed to do, resolved fresh from the database on
    every request (see docs/authorization.md - permissions are not cached).

    Deliberately excludes anything not needed to make an authorization
    decision: no password hash, tokens, or financial data.
    """

    user_id: UUID
    is_active: bool
    roles: set[str]
    permissions: set[str]

    def has_role(self, role: str) -> bool:
        return role in self.roles

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions
