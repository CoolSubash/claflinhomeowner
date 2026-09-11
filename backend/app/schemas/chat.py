from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatSessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    assessment_id: UUID | None = None


class ChatSessionPublic(BaseModel):
    id: UUID
    title: str | None
    assessment_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ChatMessageCreate(BaseModel):
    # role is deliberately not a field here - the backend always decides it
    # (Phase 8 section 9/10); a client can never post as ASSISTANT or SYSTEM.
    content: str = Field(min_length=1, max_length=4000)


class ChatMessagePublic(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    created_at: datetime


class ChatSessionWithMessages(ChatSessionPublic):
    messages: list[ChatMessagePublic]


class ChatMessageExchange(BaseModel):
    user_message: ChatMessagePublic
    assistant_message: ChatMessagePublic
