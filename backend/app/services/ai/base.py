"""
The AIService abstraction (CLAUDE.md section "AI" / Phase 8 section 1).

The rest of the application depends on this interface, never on a
provider SDK directly - `app/services/chat.py` only ever imports
`AIService`/`AIServiceError`/`ChatTurn` from here, not `anthropic`.
Swapping providers means adding a new class in this package and pointing
`app/services/ai/factory.py` at it; nothing else changes.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class AIServiceError(Exception):
    """Raised when the AI provider fails, times out, or is unavailable."""


class AIProviderNotConfigured(AIServiceError):
    """No AI provider is configured (e.g. AI_API_KEY is unset)."""


@dataclass(frozen=True)
class ChatTurn:
    """One prior turn of bounded conversation history. role is 'user' or 'assistant'."""

    role: str
    content: str


class AIService(ABC):
    @abstractmethod
    def generate_response(self, *, system_prompt: str, history: list[ChatTurn], question: str) -> str:
        """
        Generate the assistant's reply to `question`, given `system_prompt`
        (centralized instructions + authorized context - see
        app/services/ai/system_prompt.py) and a bounded slice of prior
        conversation turns.

        Must raise AIServiceError (not a provider-specific exception) on
        any failure - callers never need to know which provider is behind
        this interface.
        """
        raise NotImplementedError
