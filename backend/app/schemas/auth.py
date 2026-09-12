from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validation import normalize_email as _normalize_email
from app.schemas.validation import validate_strong_password as _validate_strong_password


class RegisterRequest(BaseModel):
    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_strong_password(value)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Name must not be blank")
        return stripped


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class ResendVerificationRequest(BaseModel):
    email: EmailStr = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
