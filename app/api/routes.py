import csv
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

# Required CSV headers (case-insensitive)
REQUIRED_CSV_HEADERS = {"sku", "name", "description"}


def validate_csv_headers(file_path: Path) -> tuple[bool, list[str]]:
    """
    Validate CSV headers against required headers.
    Returns (is_valid, missing_headers).
    Headers are checked case-insensitively.
    Extra columns are allowed.
    """
    try:
        with file_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            
            # Check if file has headers
            if reader.fieldnames is None or len(reader.fieldnames) == 0:
                return False, list(REQUIRED_CSV_HEADERS)
            
            # Get headers from the first row (case-insensitive, strip whitespace)
            # Handle headers with extra whitespace or special characters
            csv_headers = {header.strip().lower() for header in reader.fieldnames if header and header.strip()}
            
            # Check for required headers (case-insensitive)
            missing_headers = [
                header for header in REQUIRED_CSV_HEADERS
                if header.lower() not in csv_headers
            ]
            
            return len(missing_headers) == 0, missing_headers
    except Exception:
        # If we can't read the file (encoding issues, empty file, etc.), consider it invalid
        return False, list(REQUIRED_CSV_HEADERS)


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

    # Validate CSV headers BEFORE enqueuing the task
    # This prevents invalid files from starting background jobs
    is_valid, missing_headers = validate_csv_headers(file_path)
    if not is_valid:
        # Clean up the uploaded file since it's invalid
        try:
            file_path.unlink()
        except Exception:
            pass  # Ignore cleanup errors
        
        # Build user-friendly error message
        required_str = ", ".join(sorted(REQUIRED_CSV_HEADERS))
        missing_str = ", ".join(missing_headers)
        error_message = f"Invalid CSV format. Required headers: {required_str}. Missing: {missing_str}."
        
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid CSV format",
                "message": error_message,
                "required_headers": sorted(list(REQUIRED_CSV_HEADERS)),
                "missing_headers": missing_headers,
            }
        )

    # Only enqueue Celery task if headers are valid
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

    # Return both UUID and Celery task ID for flexibility
    return {
        "job_id": str(import_job.id),  # UUID for job management
        "celery_task_id": job_id,  # Celery task ID for SSE
    }

