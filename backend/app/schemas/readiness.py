from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ScoreBreakdownPublic(BaseModel):
    category: str
    score: int
    weight: Decimal
    raw_value: Decimal
    explanation: str

    @classmethod
    def from_row(cls, row: dict) -> "ScoreBreakdownPublic":
        return cls(
            category=row["category"],
            score=row["category_score"],
            weight=row["weight"],
            raw_value=row["raw_value"],
            explanation=row["explanation"],
        )


class ReadinessResultPublic(BaseModel):
    id: UUID
    assessment_id: UUID
    scoring_version: str
    overall_score: int
    readiness_level: str
    created_at: datetime
    components: list[ScoreBreakdownPublic]

    @classmethod
    def from_rows(cls, result_row: dict, breakdown_rows: list[dict]) -> "ReadinessResultPublic":
        return cls(
            id=result_row["id"],
            assessment_id=result_row["assessment_id"],
            scoring_version=result_row["scoring_version"],
            overall_score=result_row["overall_score"],
            readiness_level=result_row["status"] if "status" in result_row else result_row["readiness_level"],
            created_at=result_row["created_at"],
            components=[ScoreBreakdownPublic.from_row(row) for row in breakdown_rows],
        )


class ReadinessResultSummary(BaseModel):
    id: UUID
    assessment_id: UUID
    scoring_version: str
    overall_score: int
    readiness_level: str
    created_at: datetime

    @classmethod
    def from_row(cls, row: dict) -> "ReadinessResultSummary":
        return cls(
            id=row["id"],
            assessment_id=row["assessment_id"],
            scoring_version=row["scoring_version"],
            overall_score=row["overall_score"],
            readiness_level=row["status"],
            created_at=row["created_at"],
        )
