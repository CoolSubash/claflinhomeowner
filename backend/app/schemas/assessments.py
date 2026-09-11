from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

# Bounds mirror the assessments table's actual column precision
# (NUMERIC(12,2) / NUMERIC(4,1)) so an out-of-range value is rejected as a
# clean 422 here rather than surfacing as a raw database error later.
_MONEY_MAX = Decimal("9999999999.99")
_EMPLOYMENT_YEARS_MAX = Decimal("999.9")


class AssessmentCreate(BaseModel):
    income: Decimal | None = Field(default=None, ge=0, le=_MONEY_MAX)
    monthly_debt: Decimal | None = Field(default=None, ge=0, le=_MONEY_MAX)
    credit_score: int | None = Field(default=None, ge=300, le=850)
    savings: Decimal | None = Field(default=None, ge=0, le=_MONEY_MAX)
    down_payment: Decimal | None = Field(default=None, ge=0, le=_MONEY_MAX)
    target_home_price: Decimal | None = Field(default=None, gt=0, le=_MONEY_MAX)
    employment_years: Decimal | None = Field(default=None, ge=0, le=_EMPLOYMENT_YEARS_MAX)
    location: str | None = Field(default=None, max_length=255)


class AssessmentUpdate(AssessmentCreate):
    """
    Same shape/validation as AssessmentCreate. PATCH applies each provided
    field via COALESCE against the existing row (see
    services/assessments.py) - omitting a field leaves it unchanged, but a
    field can't be explicitly cleared back to null once set. That's an
    intentional simplification: there's no product need to "unset" a
    financial figure while filling out a draft.
    """


class AssessmentPublic(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    income: Decimal | None
    monthly_debt: Decimal | None
    credit_score: int | None
    savings: Decimal | None
    down_payment: Decimal | None
    target_home_price: Decimal | None
    employment_years: Decimal | None
    location: str | None
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
