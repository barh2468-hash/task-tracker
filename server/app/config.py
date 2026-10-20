from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    supabase_url: str
    supabase_anon_key: str
    anthropic_api_key: str
    anthropic_model: str = "claude-sonnet-5-5"
    cors_origins: str = "http://localhost:5173"


settings = Settings()
