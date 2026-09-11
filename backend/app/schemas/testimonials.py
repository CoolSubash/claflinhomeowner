from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TestimonialCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=500)


class TestimonialPublic(BaseModel):
    id: UUID
    author_name: str
    author_role: str
    rating: int
    content: str
    created_at: datetime
