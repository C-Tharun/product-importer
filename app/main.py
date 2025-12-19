import logging
import subprocess

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.jobs import router as jobs_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.app_name)


# ----------------------------
# Startup: run DB migrations
# ----------------------------
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


# ----------------------------
# CORS configuration
# ----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        # add deployed frontend URL here later (Vercel/Render)
        # e.g. "https://product-importer-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# API routes
# ----------------------------
app.include_router(api_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")


# ----------------------------
# Health & root endpoints
# ----------------------------
@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "service": settings.app_name,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
