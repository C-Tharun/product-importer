from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Product Importer API"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/product_importer"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    upload_dir: str = "uploads"
    batch_size: int = 500

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    # Cache to avoid re-parsing env variables across imports.
    return Settings()


settings = get_settings()

