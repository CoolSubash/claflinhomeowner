from __future__ import annotations

import logging

from anthropic import AnthropicBedrock, APIError

from app.services.ai.anthropic_common import MAX_RESPONSE_TOKENS, extract_text
from app.services.ai.base import AIService, AIServiceError, ChatTurn

logger = logging.getLogger(__name__)


class BedrockAIService(AIService):
    """
    Claude via AWS Bedrock. No API key: authentication is AWS SigV4,
    resolved by boto3's own credential chain (environment variables,
    ~/.aws/credentials, or an IAM role) - this class never accepts or
    stores an access key/secret itself, so there is no AWS credential to
    accidentally log or return in a response.
    """

    def __init__(self, *, aws_region: str, model: str) -> None:
        # No aws_access_key/aws_secret_key/aws_session_token passed here -
        # leaving them unset is what makes AnthropicBedrock fall through to
        # boto3's standard credential resolution instead of a hard-coded value.
        self._client = AnthropicBedrock(aws_region=aws_region)
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
        except APIError as exc:
            logger.warning("AIService: Bedrock request failed: %s", exc)
            raise AIServiceError("AI provider request failed") from exc
        except RuntimeError as exc:
            # AnthropicBedrock's own auth layer raises a plain RuntimeError
            # ("could not resolve credentials from session") when boto3's
            # credential chain comes up empty - treat that as a provider
            # failure too, never as an unhandled 500.
            logger.warning("AIService: Bedrock credential resolution failed: %s", exc)
            raise AIServiceError("AI provider request failed") from exc

        return extract_text(response)
