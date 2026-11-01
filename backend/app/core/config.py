# Ei file .env theke sob setting pore.
# Code-er bhitore kono password/secret likhbo na.
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "AI Interview Platform"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str

    JWT_SECRET: str
    ACCESS_TOKEN_MINUTES: int = 60
    CANDIDATE_REFRESH_DAYS: int = 30
    COMPANY_SESSION_HOURS: int = 24

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD_HASH: str = ""

    # Comma diye alada kora allowed frontend address
    FRONTEND_ORIGINS: str = "http://localhost:5173"
    PUBLIC_APP_URL: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]


settings = Settings()
