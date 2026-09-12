"""
Shared between anthropic_provider.py and bedrock_provider.py: both talk to
the same Messages API shape (Bedrock's AnthropicBedrock client returns the
identical response type as the direct Anthropic client), so response
validation lives here once instead of twice.
"""
from __future__ import annotations

from app.services.ai.base import AIServiceError

MAX_RESPONSE_TOKENS = 1024
# Sanity ceiling on what we'll accept back from the provider - don't
# blindly trust provider output. Well above any reasonable chat reply;
# exists to fail closed on a malformed/runaway response rather than pass
# it straight to the client.
MAX_RESPONSE_CHARS = 8000


def extract_text(response: object) -> str:
    content = getattr(response, "content", None)
    if not isinstance(content, list) or not content:
        raise AIServiceError("AI provider returned an unexpected response shape")

    parts = [block.text for block in content if getattr(block, "type", None) == "text"]
    text = "".join(parts).strip()

    if not text:
        raise AIServiceError("AI provider returned an empty response")
    if len(text) > MAX_RESPONSE_CHARS:
        text = text[:MAX_RESPONSE_CHARS]
    return text
