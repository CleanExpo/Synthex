"""
Service configuration via environment variables.

Uses pydantic BaseSettings for validation and .env file support.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Adaptive Intelligence Service configuration."""

    SERVICE_API_KEY: str = ""
    CALLBACK_BASE_URL: Optional[str] = None
    INTERNAL_API_KEY: Optional[str] = None  # Key for callbacks to Synthex
    PORT: int = 8000

    # Engine toggles (disable individually if dependencies unavailable)
    ENABLE_BO: bool = True
    ENABLE_PROPHET: bool = True
    ENABLE_BAYESNF: bool = True

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
