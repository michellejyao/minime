"""Application configuration from environment variables."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from backend root (parent of app/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_nested_delimiter="__",
    )

    openai_api_key: str
    supabase_db_url: str
    # ElevenLabs: optional; required for interview voice clone (TTS)
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str | None = None

    @field_validator("supabase_db_url")
    @classmethod
    def supabase_url_must_be_configured(cls, v: str) -> str:
        if not v or "PROJECT_REF" in v:
            raise ValueError(
                "SUPABASE_DB_URL must be set to your real Supabase connection URI. "
                "Get it from Supabase Dashboard → Project Settings → Database → "
                "Connection string (URI), then change postgresql:// to postgresql+asyncpg:// "
                "and replace PROJECT_REF with your project ref (host like db.xxxxx.supabase.co)."
            )
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError(
                "SUPABASE_DB_URL must use the async driver: postgresql+asyncpg://..."
            )
        return v


def get_settings() -> Settings:
    """Return application settings (singleton-style)."""
    return Settings()
