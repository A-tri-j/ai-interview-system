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

    # OTP setting
    OTP_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD_HASH: str = ""

    FRONTEND_ORIGINS: str = "http://localhost:5173"
    PUBLIC_APP_URL: str = "http://localhost:5173"

    # CV upload ar notification setting
    UPLOAD_DIR: str = "uploads"
    MAX_CV_MB: int = 5
    NOTIFY_ON_REJECTION: bool = False   # reject-e email jabe na (default)
    INTERVIEW_LINK_DAYS: int = 7
    RESET_TOKEN_MINUTES: int = 30

    # AI / RAG
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_TIMEOUT: int = 40
    EMBED_MODEL: str = "BAAI/bge-small-en-v1.5"   # 384 dimension
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 120
    RAG_TOP_K: int = 6

    # Recording, storage, transcription
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    SIGNED_URL_SECONDS: int = 600
    MAX_RECORDING_MB: int = 24  # Groq Whisper-er 25 MB limit-er niche
    MAX_ANSWER_SECONDS: int = 45  # frontend timer-er jonno
    FOLLOWUP_COUNT: int = 5  # 5 theke 7
    RECORDING_RETENTION_DAYS: int = 90
    CONSENT_VERSION: str = "v1"
    NOTIFY_INTERVIEW_DONE: bool = False  # interview shesh-er email (default off)
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    WHISPER_LANGUAGE: str = "en"  # faka dile auto-detect

    # Gmail SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_EMAIL: str = ""
    SMTP_APP_PASSWORD: str = ""
    EMAIL_FROM_NAME: str = "AI Interview Platform"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    @property
    def smtp_configured(self) -> bool:
        return bool(
            self.SMTP_EMAIL
            and self.SMTP_APP_PASSWORD
            and self.SMTP_APP_PASSWORD != "your-app-password"
        )

    @property
    def r2_configured(self) -> bool:
        return all([self.R2_ACCOUNT_ID, self.R2_ACCESS_KEY_ID, self.R2_SECRET_ACCESS_KEY, self.R2_BUCKET])


settings = Settings()
