import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # LLM: Sarvam (SARVAM_API_KEY) or OpenAI / Azure OpenAI (OPENAI_*).
    # If SARVAM_API_KEY is set, it takes precedence over OPENAI_API_KEY.
    SARVAM_API_KEY: Optional[str] = None
    SARVAM_BASE_URL: str = "https://api.sarvam.ai/v1"
    SARVAM_CHAT_MODEL: str = "sarvam-105b"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"

    # Per-task model overrides (optional; default to the active provider's chat model)
    LLM_MODEL_SUMMARY: Optional[str] = None
    LLM_MODEL_ELIGIBILITY: Optional[str] = None
    LLM_MODEL_OEM: Optional[str] = None
    LLM_MODEL_ROW: Optional[str] = None
    
    # Server Config
    PORT: int = 3000
    NODE_ENV: str = "development"
    MAX_FILE_SIZE_MB: int = 50
    
    # CORS - For deployment, set allowed origins (comma-separated)
    # e.g. CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
    CORS_ORIGINS: str = "*"  # "*" allows all; restrict in production
    
    # Database Config (PostgreSQL) - Kept for migration period
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "12345"  # Match your PostgreSQL password
    POSTGRES_HOST: str = "127.0.0.1"  # Set in .env to DB server IP (or 127.0.0.1 if DB on same machine)
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "Bid2"  # Main database for Bid Intelligence project
    DATABASE_URL: Optional[str] = None
    
    # MongoDB Config
    MONGODB_STRING: Optional[str] = None  # Connection string from .env
    MONGODB_DB: str = "bid_intelligence"  # Database name in MongoDB

    # Optional external services (set in .env for production / network IP)
    CHATBOT_API_URL: Optional[str] = None  # e.g. http://192.168.1.10:8080
    
    # JWT
    JWT_SECRET: str = "change-me-in-production"
    
    # Org-wide quota: base + purchased (shared by Bid Admin + all Bid Managers)
    ORG_QUOTA_BASE: int = 50
    RECHARGE_SINGLE_AMOUNT: float = 3.0   # 1 project = $3
    RECHARGE_BULK_AMOUNT: float = 25.0    # 10 projects = $25
    RECHARGE_SINGLE_PROJECTS: int = 1
    RECHARGE_BULK_PROJECTS: int = 10

    # PayPal (set in .env for production)
    PAYPAL_MODE: str = "sandbox"  # sandbox | live
    PAYPAL_CLIENT_ID: Optional[str] = None
    PAYPAL_CLIENT_SECRET: Optional[str] = None

    # Versioning
    PROCESSING_VERSION: int = 32
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
