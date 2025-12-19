from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # proactively validate connections to avoid stale errors
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


def get_db():
    """Yield a DB session for FastAPI dependencies."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

