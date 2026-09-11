from __future__ import annotations

import logging

import anthropic

from app.services.ai.base import AIService, AIServiceError, ChatTurn

logger = logging.getLogger(__name__)

_MAX_RESPONSE_TOKENS = 1024
# Sanity ceiling on what we'll accept back from the provider (Phase 8
# section 32: don't blindly trust provider output). Well above any
# reasonable chat reply; exists to fail closed on a malformed/runaway
# response rather than pass it straight to the client.
_MAX_RESPONSE_CHARS = 8000


class AnthropicAIService(AIService):
    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate_response(self, *, system_prompt: str, history: list[ChatTurn], question: str) -> str:
        messages = [{"role": turn.role, "content": turn.content} for turn in history]
        messages.append({"role": "user", "content": question})

        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=_MAX_RESPONSE_TOKENS,
                system=system_prompt,
                messages=messages,
            )
        except anthropic.APIError as exc:
            # Covers timeout, rate limit, invalid API key, provider-side
            # 5xx, and network failure - anthropic's SDK raises subclasses
            # of APIError for all of these. Never surface exc's message to
            # the end user (may contain provider/account details); log it
            # for operators instead.
            logger.warning("AIService: Anthropic request failed: %s", exc)
            raise AIServiceError("AI provider request failed") from exc

        return _extract_text(response)


def _extract_text(response: object) -> str:
    content = getattr(response, "content", None)
    if not isinstance(content, list) or not content:
        raise AIServiceError("AI provider returned an unexpected response shape")

    parts = [block.text for block in content if getattr(block, "type", None) == "text"]
    text = "".join(parts).strip()

    if not text:
        raise AIServiceError("AI provider returned an empty response")
    if len(text) > _MAX_RESPONSE_CHARS:
        text = text[:_MAX_RESPONSE_CHARS]
    return text
