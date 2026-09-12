"""Shared Pydantic field-validation helpers used across more than one schema module."""
import re


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_strong_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Za-z]", value):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"[0-9]", value):
        raise ValueError("Password must contain at least one digit")
    return value
