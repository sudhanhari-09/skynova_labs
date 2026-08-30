from typing import List, Any, Annotated
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict, NoDecode


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Project Labs"
    app_version: str = "2.0.0"
    debug: bool = True
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    workers: bool = False

    # Database (loaded from backend/.env; no hardcoded credentials)
    database_url: str = ""
    secret_key: str = "change-this-to-a-strong-random-key-in-production"

    # Security
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # Separate secret used ONLY for refresh tokens (spec §57, §69)
    jwt_refresh_secret: str = ""
    # Login attempt protection (spec §57)
    max_login_attempts: int = 5
    login_lockout_minutes: int = 15
    # Password reset token lifetime (minutes)
    password_reset_expire_minutes: int = 30

    # Public-form rate limiting (spec §60)
    rate_limit_max_requests: int = 10
    rate_limit_window_seconds: int = 600

    # CORS
    cors_origins: Annotated[list, NoDecode] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> Any:
        """Accept both JSON arrays and comma-separated strings from .env."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Email / WhatsApp
    smtp_host: str = "smtp.example.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@projectlabs.local"
    whatsapp_api_key: str = ""
    # Evolution API (spec §55)
    evolution_api_url: str = ""
    evolution_api_key: str = ""
    evolution_instance: str = ""

    # Frontend
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://127.0.0.1:8000"

    # File storage (spec §59): "local" or "s3" compatible
    storage_type: str = "local"
    storage_path: str = "./storage"

    # Payment gateways: "simulated" (default), "stripe", "paypal"
    payment_gateway: str = "simulated"
    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    # PayPal
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_mode: str = "sandbox"  # sandbox | live

    # Upload validation (spec §59)
    upload_max_size_mb: int = 10
    upload_allowed_types: str = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

    @property
    def cors_origins_str(self) -> str:
        return ",".join(self.cors_origins)


settings = Settings()