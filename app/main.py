from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.jobs import router as jobs_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}

