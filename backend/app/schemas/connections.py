from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class ConnectionRequestForRealtor(BaseModel):
    """
    The realtor-facing view of a connection request. Deliberately excludes
    the requester's email/id - only enough to reach out is exposed (first
    name + last initial, same minimization pattern as public testimonials),
    per CLAUDE.md's "share only the minimum necessary information."
    """

    id: UUID
    status: str
    requester_name: str
    consent_given_at: datetime
    created_at: datetime
    updated_at: datetime


class ConnectionRespondRequest(BaseModel):
    status: Literal["ACCEPTED", "DECLINED"]
