from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str | None = None

    jwt_secret: str | None = None
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # AWS credentials themselves are never a Settings field - boto3 (used
    # by the Bedrock AIService provider, and later by S3 document storage)
    # reads AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN (or
    # an IAM role) directly from the environment/instance metadata on its
    # own. Keeping them out of this class means they can never accidentally
    # end up in a log, an error message, or a response model that happens
    # to dump `Settings`.
    aws_region: str | None = None
    aws_s3_bucket: str | None = None
    aws_kms_key_id: str | None = None

    # Where the frontend lives - used only to build links that leave the
    # backend (e.g. an email verification URL). Never used for CORS or any
    # security decision; the frontend never calls Postgres or this backend
    # directly from the browser regardless of this value.
    frontend_base_url: str = "http://localhost:3000"

    # "bedrock" (Claude via AWS Bedrock, no API key - see aws_region above)
    # or "anthropic" (direct Anthropic API, needs ai_api_key).
    ai_provider: str = "bedrock"
    ai_api_key: str | None = None
    # Bedrock model id by default (e.g. "anthropic.claude-3-5-sonnet-20241022-v2:0").
    # If AI_PROVIDER=anthropic, set this to a direct-API model alias instead
    # (e.g. "claude-3-5-sonnet-latest") - the two providers use different
    # model-id formats for the same underlying model family.
    ai_model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
