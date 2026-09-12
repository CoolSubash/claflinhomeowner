from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validation import normalize_email, validate_strong_password


class RealEstatePartnerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contact_email: EmailStr | None = Field(default=None, max_length=320)
    contact_phone: str | None = Field(default=None, max_length=30)

    @field_validator("contact_email")
    @classmethod
    def normalize_contact_email(cls, value: str | None) -> str | None:
        return normalize_email(value) if value else value


class RealEstatePartnerPublic(BaseModel):
    id: UUID
    name: str
    contact_email: str | None
    contact_phone: str | None
    is_active: bool
    user_id: UUID | None
    created_at: datetime


class RealtorInviteCreate(BaseModel):
    email: EmailStr = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return normalize_email(value)


class RealtorInvitationPublic(BaseModel):
    id: UUID
    partner_id: UUID
    email: str
    expires_at: datetime
    used_at: datetime | None
    created_at: datetime


class RealtorInviteLookupRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class RealtorInviteLookupResponse(BaseModel):
    email: str
    # Tells the frontend which form to show: a "set your password" form
    # for a brand-new account, or a plain "confirm and link" step for an
    # email that already has one - see docs/realtor-onboarding.md.
    account_exists: bool


class RealtorInviteAcceptRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    # Only required when the invited email has no existing account yet -
    # enforced in the service layer (app/services/realtor_invitations.py),
    # not here, since "required" depends on database state this schema
    # can't see.
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        return validate_strong_password(value) if value else value
