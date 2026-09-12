from __future__ import annotations

import logging

import anthropic

from app.services.ai.anthropic_common import MAX_RESPONSE_TOKENS, extract_text
from app.services.ai.base import AIService, AIServiceError, ChatTurn

logger = logging.getLogger(__name__)


class AnthropicAIService(AIService):
    """Direct Anthropic API - requires AI_API_KEY. See BedrockAIService for the AWS-routed alternative."""

    def __init__(self, *, api_key: str, model: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def generate_response(self, *, system_prompt: str, history: list[ChatTurn], question: str) -> str:
        messages = [{"role": turn.role, "content": turn.content} for turn in history]
        messages.append({"role": "user", "content": question})

        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=MAX_RESPONSE_TOKENS,
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

        return extract_text(response)
