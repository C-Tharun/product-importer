import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis_client import cache_job_progress
from app.db.session import get_db
from app.models.import_job import ImportJob, ImportJobStatus
from app.tasks.product_import import import_products_from_csv

router = APIRouter()


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """
    Accept CSV upload, stream it to disk, and enqueue background processing.
    Creates an import_job record for progress tracking.
    The request thread only handles storage + task enqueue to avoid blocking the API.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = file.filename.replace(" ", "_")
    file_path = upload_dir / f"{uuid.uuid4()}_{safe_name}"

    # Stream to disk in chunks to avoid loading the whole file in memory.
    try:
        with file_path.open("wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    finally:
        await file.close()

    # Enqueue Celery task first to get task ID
    task = import_products_from_csv.delay(str(file_path))
    job_id = task.id

    # Create import_job record for progress tracking
    import_job = ImportJob(
        id=uuid.uuid4(),
        celery_task_id=job_id,
        status=ImportJobStatus.PENDING.value,
        progress=0,
        file_path=str(file_path),
        file_name=file.filename,
    )
    db.add(import_job)
    db.commit()
    db.refresh(import_job)

    # Cache initial state in Redis for fast SSE lookups
    cache_job_progress(
        job_id=job_id,
        status=ImportJobStatus.PENDING.value,
        progress=0,
        total_rows=None,
        processed_rows=0,
    )

    return {"job_id": job_id}

