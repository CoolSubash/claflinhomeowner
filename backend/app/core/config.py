from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str | None = None

    jwt_secret: str | None = None
    refresh_token_secret: str | None = None

    aws_region: str | None = None
    aws_s3_bucket: str | None = None
    aws_kms_key_id: str | None = None

    ai_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
