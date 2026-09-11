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
