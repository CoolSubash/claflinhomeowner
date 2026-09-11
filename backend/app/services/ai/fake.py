"""
Test double for AIService (Phase 8 section 34). Lets the application be
tested end-to-end without a real API key - see
app/api/deps.py::get_ai_service, overridden in tests via
app.dependency_overrides.
"""
from __future__ import annotations

from app.services.ai.base import AIService, AIServiceError, ChatTurn


class FakeAIService(AIService):
    def __init__(self, *, response: str = "This is a mocked assistant response.", fail: bool = False) -> None:
        self._response = response
        self._fail = fail
        # Recorded for tests to assert on exactly what context reached the
        # "provider" - e.g. that it never contains another user's data.
        self.calls: list[dict] = []

    def generate_response(self, *, system_prompt: str, history: list[ChatTurn], question: str) -> str:
        self.calls.append({"system_prompt": system_prompt, "history": history, "question": question})
        if self._fail:
            raise AIServiceError("Simulated AI provider failure")
        return self._response
