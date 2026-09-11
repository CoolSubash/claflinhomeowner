from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class RecommendationPublic(BaseModel):
    id: UUID
    readiness_result_id: UUID
    category: str
    priority: str
    title: str
    description: str
    source: str
    created_at: datetime
