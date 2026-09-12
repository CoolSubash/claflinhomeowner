"""
The only EmailService implementation today. No SMTP/SES credentials are
configured anywhere in this project yet (CLAUDE.md's AWS section lists
S3/KMS, not SES) - rather than fail registration or fake success, this
provider logs the verification link to the backend's own log output,
which is exactly where a developer running this locally can read it. It
never writes the token, only the finished URL - see the docstring on
`log_event`'s callers for the same "don't log secrets" rule.
"""
from __future__ import annotations

import logging

from app.services.email.base import EmailService

logger = logging.getLogger("app.email")


class ConsoleEmailService(EmailService):
    def send_verification_email(self, *, to_email: str, first_name: str, verification_url: str) -> None:
        logger.info(
            "Verification email for %s (%s): %s",
            to_email,
            first_name,
            verification_url,
        )

    def send_realtor_invite_email(self, *, to_email: str, invite_url: str) -> None:
        logger.info("Realtor invitation for %s: %s", to_email, invite_url)
