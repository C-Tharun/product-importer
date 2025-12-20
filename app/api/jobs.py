import asyncio
import json
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.redis_client import get_cached_job_progress, delete_cached_job_progress, cache_job_progress, set_job_cancelled
from app.db.session import get_db
from app.models.import_job import ImportJob, ImportJobStatus

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, db: Session = Depends(get_db)) -> dict:
    """
    Get current status of an import job.
    Checks Redis cache first, then falls back to DB.
    Accepts either UUID or Celery task ID.
    """
    # Resolve job_id to celery_task_id for Redis lookups
    # Redis stores data with celery_task_id as the key
    celery_task_id = None
    import_job = None
    
    try:
        job_uuid = uuid.UUID(job_id)
        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
        if import_job:
            celery_task_id = import_job.celery_task_id
    except (ValueError, AttributeError):
        # If job_id is not a UUID, assume it's already a celery_task_id
        celery_task_id = job_id
    
    # Try Redis cache first (fast path) using celery_task_id
    if celery_task_id:
        cached = get_cached_job_progress(celery_task_id)
    if cached:
        return {
                "job_id": str(import_job.id) if import_job else job_id,
                "celery_task_id": celery_task_id,
            **cached,
        }

    # Fall back to database if not found in cache
    if not import_job:
        if celery_task_id:
            import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == celery_task_id).first()
        else:
            # Last resort: try job_id as celery_task_id
            import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()

    if not import_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get estimated time remaining from cache if available
    cached = get_cached_job_progress(import_job.celery_task_id)
    eta_seconds = cached.get("eta_seconds") if cached else None

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
        "eta_seconds": eta_seconds,
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
    Accepts either UUID or Celery task ID.
    """
    from app.db.session import SessionLocal
    
    async def event_generator():
        """Generate SSE events with job progress updates."""
        last_status = None
        last_progress = -1
        last_processed_rows = -1
        db = SessionLocal()  # Create a new DB session for this generator
        
        # Resolve job_id to celery_task_id for Redis lookups
        # Redis stores data with celery_task_id as the key
        celery_task_id = None
        try:
            job_uuid = uuid.UUID(job_id)
            import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
            if import_job:
                celery_task_id = import_job.celery_task_id
        except (ValueError, AttributeError):
            # If job_id is not a UUID, assume it's already a celery_task_id
            celery_task_id = job_id

        try:
            while True:
                # Try Redis cache first (fast path) using celery_task_id
                cached = None
                if celery_task_id:
                    cached = get_cached_job_progress(celery_task_id)
                
                if cached:
                    status = cached.get("status")
                    progress = cached.get("progress", 0)
                    total_rows = cached.get("total_rows")
                    processed_rows = cached.get("processed_rows", 0)
                    error_message = cached.get("error_message")
                    eta_seconds = cached.get("eta_seconds")
                else:
                    # Fall back to database
                    if not celery_task_id:
                        # Need to look up the job to get celery_task_id
                    try:
                        job_uuid = uuid.UUID(job_id)
                        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
                        except (ValueError, AttributeError):
                        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()
                    else:
                        # We have celery_task_id, look up by that
                        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == celery_task_id).first()

                    if not import_job:
                        # Job not found - send error and close
                        yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                        break

                    # Update celery_task_id if we didn't have it
                    if not celery_task_id:
                        celery_task_id = import_job.celery_task_id

                    status = import_job.status
                    progress = import_job.progress
                    total_rows = import_job.total_rows
                    processed_rows = import_job.processed_rows or 0
                    error_message = import_job.error_message
                    eta_seconds = None  # Estimated time remaining is calculated in cache, not stored in DB

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
                    if eta_seconds is not None:
                        event_data["eta_seconds"] = eta_seconds
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


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """
    Delete an import job.
    Clears the job from database and Redis cache.
    """
    # Try to find the job by UUID or celery_task_id
    try:
        job_uuid = uuid.UUID(job_id)
        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
    except ValueError:
        # If job_id is not a UUID, try celery_task_id
        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()

    if not import_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete from Redis cache
    delete_cached_job_progress(import_job.celery_task_id)
    
    # Delete from database
    db.delete(import_job)
    db.commit()

    return None


@router.put("/jobs/{job_id}/cancel", status_code=200)
async def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """
    Cancel a running import job by revoking the Celery task.
    This stops processing immediately and marks the job as failed.
    Accepts either UUID or Celery task ID.
    """
    from app.celery_app import celery_app
    
    # Try to find the job by UUID first, then by celery_task_id
    import_job = None
    try:
        job_uuid = uuid.UUID(job_id)
        import_job = db.query(ImportJob).filter(ImportJob.id == job_uuid).first()
    except (ValueError, AttributeError):
        # If job_id is not a UUID, try celery_task_id
        pass
    
    # If not found by UUID, try celery_task_id
    if not import_job:
        import_job = db.query(ImportJob).filter(ImportJob.celery_task_id == job_id).first()

    if not import_job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Only allow canceling jobs that are pending or processing
    if import_job.status not in (ImportJobStatus.PENDING.value, ImportJobStatus.PROCESSING.value):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {import_job.status}"
        )

    # Set cancellation flag in Redis (checked by task during processing)
    celery_task_id = import_job.celery_task_id
    set_job_cancelled(celery_task_id)
    
    # Also try to revoke the Celery task (best effort)
    try:
        celery_app.control.revoke(celery_task_id, terminate=True)
    except Exception as e:
        # Log error but continue with marking job as cancelled
        # The Redis flag will stop processing on next batch check
        print(f"Error revoking Celery task {celery_task_id}: {e}")

    # Mark job as failed with cancellation message
    import_job.status = ImportJobStatus.FAILED.value
    import_job.error_message = "Job cancelled by user"
    db.commit()

    # Update Redis cache
    cache_job_progress(
        job_id=celery_task_id,
        status=ImportJobStatus.FAILED.value,
        progress=import_job.progress,
        total_rows=import_job.total_rows,
        processed_rows=import_job.processed_rows,
        error_message="Job cancelled by user",
    )

    return {
        "message": "Job cancelled successfully",
        "job_id": str(import_job.id),
        "status": import_job.status,
    }

