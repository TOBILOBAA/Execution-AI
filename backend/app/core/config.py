from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Google AI Studio API key (get one at https://aistudio.google.com/apikey)
    # Required for all AI features in this app.
    google_ai_api_key: str = ""

    # Gemini model id for generateContent. Prefer a Flash model for lower latency.
    gemini_model: str = Field(default="gemini-2.5-flash")
    # Hard cap on HTTP wait (milliseconds). Prevents hanging forever if the API stalls.
    gemini_request_timeout_ms: int = Field(
        default=120_000,
        validation_alias=AliasChoices("GEMINI_REQUEST_TIMEOUT_MS"),
    )
    # Lower values reduce worst-case latency for JSON planning responses.
    gemini_max_output_tokens: int = Field(
        default=4096,
        validation_alias=AliasChoices("GEMINI_MAX_OUTPUT_TOKENS"),
    )

    # App
    app_env: str = "development"
    cors_origins: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ORIGINS"),
    )
    cors_origin_regex: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ORIGIN_REGEX"),
    )
    report_cutoff_hour: int = 18  # 18:00 UTC default


@lru_cache
def get_settings() -> Settings:
    return Settings()
