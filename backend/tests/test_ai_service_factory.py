import pytest

from app.api.deps import get_ai_service
from app.core.config import get_settings
from app.services.ai.anthropic_provider import AnthropicAIService
from app.services.ai.base import AIProviderNotConfigured
from app.services.ai.bedrock_provider import BedrockAIService


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _override_settings(monkeypatch, **overrides):
    base = get_settings()
    patched = base.model_copy(update=overrides)
    monkeypatch.setattr("app.api.deps.get_settings", lambda: patched)


def test_bedrock_selected_and_region_set_returns_bedrock_service(monkeypatch) -> None:
    _override_settings(monkeypatch, ai_provider="bedrock", aws_region="us-east-1")
    assert isinstance(get_ai_service(), BedrockAIService)


def test_bedrock_selected_without_region_is_unconfigured(monkeypatch) -> None:
    _override_settings(monkeypatch, ai_provider="bedrock", aws_region=None)
    service = get_ai_service()
    with pytest.raises(AIProviderNotConfigured):
        service.generate_response(system_prompt="", history=[], question="hi")


def test_anthropic_selected_and_key_set_returns_anthropic_service(monkeypatch) -> None:
    _override_settings(monkeypatch, ai_provider="anthropic", ai_api_key="sk-test")
    assert isinstance(get_ai_service(), AnthropicAIService)


def test_anthropic_selected_without_key_is_unconfigured(monkeypatch) -> None:
    _override_settings(monkeypatch, ai_provider="anthropic", ai_api_key=None)
    service = get_ai_service()
    with pytest.raises(AIProviderNotConfigured):
        service.generate_response(system_prompt="", history=[], question="hi")


def test_unsupported_provider_raises(monkeypatch) -> None:
    _override_settings(monkeypatch, ai_provider="made-up-provider")
    with pytest.raises(RuntimeError, match="Unsupported AI_PROVIDER"):
        get_ai_service()
