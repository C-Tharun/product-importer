import uuid
from enum import Enum as PyEnum
from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class ImportJobStatus(PyEnum):
    """Status enum for import jobs."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportJob(Base):
    """
    Tracks CSV import job progress and status.
    Used for real-time progress updates via SSE.
    """
    __tablename__ = "import_jobs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    # Celery task ID - links to the actual background task
    celery_task_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # Job status: pending -> processing -> completed/failed
    status = Column(String(50), nullable=False, default=ImportJobStatus.PENDING.value, index=True)
    
    # Progress tracking (0-100)
    progress = Column(Integer, nullable=False, default=0)
    
    # Row counts for progress calculation
    total_rows = Column(Integer, nullable=True)
    processed_rows = Column(Integer, nullable=True, default=0)
    
    # Error information if job fails
    error_message = Column(Text, nullable=True)
    
    # File information (for display purposes)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

