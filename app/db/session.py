from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Create engine with connection pooling
# pool_pre_ping validates connections before use to avoid stale connection errors
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    # Note: future=True removed - deprecated in SQLAlchemy 2.0
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """Yield a DB session for FastAPI dependencies."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

