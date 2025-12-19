import uuid
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import settings
from app.tasks.product_import import import_products_from_csv

router = APIRouter()


@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)) -> dict:
    """
    Accept CSV upload, stream it to disk, and enqueue background processing.
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

    task = import_products_from_csv.delay(str(file_path))
    return {"job_id": task.id}

