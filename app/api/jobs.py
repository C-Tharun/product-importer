import asyncio
import json
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.redis_client import get_cached_job_progress
from app.db.session import get_db
from app.models.import_job import ImportJob

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)) -> dict:
    """
    Get current status of an import job.
    Checks Redis cache first, then falls back to DB.
    """
    # Try Redis cache first (fast path)
    cached = get_cached_job_progress(job_id)
    if cached:
        return {
            "job_id": job_id,
            **cached,
        }

    # Fall back to database
    try:
        job_uuid = uuid.UUID(job_id)
        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
    except ValueError:
        # If job_id is not a UUID, try celery_task_id
        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()

    if not import_job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": str(import_job.id),
        "celery_task_id": import_job.celery_task_id,
        "status": import_job.status,
        "progress": import_job.progress,
        "total_rows": import_job.total_rows,
        "processed_rows": import_job.processed_rows,
        "error_message": import_job.error_message,
        "file_name": import_job.file_name,
        "created_at": import_job.created_at.isoformat() if import_job.created_at else None,
        "updated_at": import_job.updated_at.isoformat() if import_job.updated_at else None,
    }


@router.get("/jobs")
async def list_jobs(
    limit: int = 20,
    db: Session = Depends(get_db),
) -> dict:
    """
    List recent import jobs, ordered by creation date (newest first).
    """
    jobs = (
        db.query(ImportJob)
        .order_by(desc(ImportJob.created_at))
        .limit(limit)
        .all()
    )

    return {
        "jobs": [
            {
                "job_id": str(job.id),
                "celery_task_id": job.celery_task_id,
                "status": job.status,
                "progress": job.progress,
                "total_rows": job.total_rows,
                "processed_rows": job.processed_rows,
                "error_message": job.error_message,
                "file_name": job.file_name,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            }
            for job in jobs
        ],
        "total": len(jobs),
    }


@router.get("/jobs/{job_id}/events")
async def stream_job_events(job_id: str):
    """
    Server-Sent Events endpoint for real-time job progress updates.
    Streams JSON updates every second while job is active.
    Compatible with EventSource API in browsers.
    Uses Redis cache for fast lookups, falls back to DB when needed.
    """
    from app.db.session import SessionLocal
    
    async def event_generator():
        """Generate SSE events with job progress updates."""
        last_status = None
        last_progress = -1
        last_processed_rows = -1
        db = SessionLocal()  # Create a new DB session for this generator

        try:
            while True:
                # Try Redis cache first (fast path)
                cached = get_cached_job_progress(job_id)
                
                if cached:
                    status = cached.get("status")
                    progress = cached.get("progress", 0)
                    total_rows = cached.get("total_rows")
                    processed_rows = cached.get("processed_rows", 0)
                    error_message = cached.get("error_message")
                else:
                    # Fall back to database
                    try:
                        job_uuid = uuid.UUID(job_id)
                        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
                    except ValueError:
                        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()

                    if not import_job:
                        # Job not found - send error and close
                        yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                        break

                    status = import_job.status
                    progress = import_job.progress
                    total_rows = import_job.total_rows
                    processed_rows = import_job.processed_rows or 0
                    error_message = import_job.error_message

                # Send update if status, progress, or processed_rows changed
                # This ensures we get updates even when progress percentage stays the same
                # but processed_rows continues to increase
                if (status != last_status or 
                    progress != last_progress or 
                    processed_rows != last_processed_rows):
                    event_data = {
                        "job_id": job_id,
                        "status": status,
                        "progress": progress,
                        "total_rows": total_rows,
                        "processed_rows": processed_rows,
                        "error_message": error_message,
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                    
                    last_status = status
                    last_progress = progress
                    last_processed_rows = processed_rows

                    # Stop streaming if job is completed or failed
                    if status in ("completed", "failed"):
                        yield f"event: close\ndata: {json.dumps({'message': 'Job finished'})}\n\n"
                        break

                # Wait 1 second before next check
                await asyncio.sleep(1)
        finally:
            db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )

