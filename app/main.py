import logging
import subprocess
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.jobs import router as jobs_router
from app.api.products import router as products_router
from app.api.webhooks import router as webhooks_router
from app.core.config import settings

# -------------------------------------------------
# Logging
# -------------------------------------------------
logging.basicConfig(level=logging.INFO)

# -------------------------------------------------
# App initialization
# -------------------------------------------------
app = FastAPI(title=settings.app_name)


# -------------------------------------------------
# CORS configuration
# Must be added BEFORE routers to handle preflight requests
# -------------------------------------------------
def get_allowed_origins() -> list[str]:
    """
    Get allowed CORS origins from environment variable or settings.
    Falls back to sensible defaults if not configured.
    """
    # Check environment variable first (for Render deployment)
    env_origins = os.getenv("ALLOWED_ORIGINS")
    if env_origins:
        # Split comma-separated string and strip whitespace
        origins = [origin.strip() for origin in env_origins.split(",") if origin.strip()]
        if origins:
            logging.info(f"Using CORS origins from ALLOWED_ORIGINS env var: {origins}")
            return origins
    
    # Fall back to settings.allowed_origins
    if settings.allowed_origins:
        origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]
        logging.info(f"Using CORS origins from settings: {origins}")
        return origins
    
    # Final fallback to defaults
    default_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://product-importer-frontend-374q.onrender.com",
    ]
    logging.info(f"Using default CORS origins: {default_origins}")
    return default_origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,  # Required for cookies/auth and SSE
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods including OPTIONS for preflight
    allow_headers=["*"],  # Allow all headers including Authorization, Content-Type, etc.
    expose_headers=["*"],  # Expose headers for SSE and other use cases
    max_age=3600,  # Cache preflight requests for 1 hour
)


# -------------------------------------------------
# Startup: run DB migrations (Render free-tier safe)
# -------------------------------------------------
@app.on_event("startup")
def run_migrations() -> None:
    """
    Automatically run Alembic migrations on startup.

    Required for Render free-tier since shell access
    is not available. This is safe and idempotent.
    """
    try:
        logging.info("Running database migrations...")
        subprocess.run(
            ["alembic", "upgrade", "head"],
            check=True,
        )
        logging.info("Database migrations completed successfully.")
    except Exception as exc:
        logging.error(f"Database migration failed: {exc}")
        # Fail fast if DB schema is not ready
        raise


# -------------------------------------------------
# API routes
# -------------------------------------------------
app.include_router(api_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")


# -------------------------------------------------
# Meta & health endpoints
# -------------------------------------------------
@app.get("/", tags=["meta"])
def root() -> dict:
    """
    Root endpoint for basic service visibility.
    """
    return {
        "service": settings.app_name,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
def health() -> dict:
    """
    Lightweight health check for monitoring.
    """
    return {"status": "ok"}
