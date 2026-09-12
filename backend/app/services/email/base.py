"""
EmailService abstraction - same shape as app/services/ai/base.py, and for
the same reason: the rest of the app depends on this interface, never on a
concrete mail provider, so swapping in a real provider (e.g. AWS SES, per
CLAUDE.md's AWS section) later means adding one class here and pointing
app/api/deps.py::get_email_service at it - nothing else changes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class EmailService(ABC):
    @abstractmethod
    def send_verification_email(self, *, to_email: str, first_name: str, verification_url: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def send_realtor_invite_email(self, *, to_email: str, invite_url: str) -> None:
        raise NotImplementedError