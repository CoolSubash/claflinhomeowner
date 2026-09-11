from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str | None = None

    jwt_secret: str | None = None
    refresh_token_secret: str | None = None
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    aws_region: str | None = None
    aws_s3_bucket: str | None = None
    aws_kms_key_id: str | None = None

    # Where the frontend lives - used only to build links that leave the
    # backend (e.g. an email verification URL). Never used for CORS or any
    # security decision; the frontend never calls Postgres or this backend
    # directly from the browser regardless of this value (CLAUDE.md §4).
    frontend_base_url: str = "http://localhost:3000"

    ai_provider: str = "anthropic"
    ai_api_key: str | None = None
    # A real, publicly documented Anthropic model alias. Intentionally not
    # one of the "Claude 5 family" ids Claude Code itself runs on - those
    # are this assistant's own model ids, not necessarily what's available
    # through the public Anthropic API this app's AIService calls out to.
    ai_model: str = "claude-3-5-sonnet-latest"


@lru_cache
def get_settings() -> Settings:
    return Settings()
