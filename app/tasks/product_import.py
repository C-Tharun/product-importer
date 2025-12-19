import csv
from pathlib import Path
from typing import Iterable, List, Dict

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.core.redis_client import cache_job_progress, delete_cached_job_progress
from app.db.session import SessionLocal
from app.models.import_job import ImportJob, ImportJobStatus
from app.models.product import Product


def _normalize_sku(raw: str | None) -> str:
    return (raw or "").strip().lower()


def _prepare_product_payload(row: Dict[str, str]) -> Dict[str, object]:
    sku = _normalize_sku(row.get("sku") or row.get("SKU"))
    return {
        "sku": sku,
        "name": (row.get("name") or row.get("NAME") or "").strip(),
        "description": (row.get("description") or row.get("DESCRIPTION") or "").strip(),
        "active": True,
    }


def _chunked(iterable: Iterable[Dict[str, object]], size: int) -> Iterable[List[Dict[str, object]]]:
    batch: List[Dict[str, object]] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _upsert_batch(session: Session, payload: List[Dict[str, object]]):
    if not payload:
        return
    # Using PostgreSQL ON CONFLICT to upsert by SKU. id remains stable; sku is normalized already.
    insert_stmt = insert(Product)
    stmt = insert_stmt.on_conflict_do_update(
        index_elements=[Product.sku],
        set_={
            "name": insert_stmt.excluded.name,
            "description": insert_stmt.excluded.description,
            "active": insert_stmt.excluded.active,
            # updated_at drives cache invalidation; use DB time to keep consistent.
            "updated_at": func.now(),
        },
    )
    stmt = stmt.values(payload)
    session.execute(stmt)
    session.commit()


def _count_csv_rows(file_path: Path) -> int:
    """
    Pre-scan CSV to count total rows (excluding header).
    This allows accurate progress calculation.
    """
    try:
        with file_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            return sum(1 for _ in reader)
    except Exception:
        return 0


def _update_job_progress(
    session: Session,
    celery_task_id: str,
    status: str,
    progress: int,
    total_rows: int | None = None,
    processed_rows: int | None = None,
    error_message: str | None = None,
) -> None:
    """
    Update import_job record in DB and Redis cache.
    This is called periodically during processing to track progress.
    """
    import_job = session.query(ImportJob).filter(ImportJob.celery_task_id == celery_task_id).first()
    if import_job:
        import_job.status = status
        import_job.progress = progress
        if total_rows is not None:
            import_job.total_rows = total_rows
        if processed_rows is not None:
            import_job.processed_rows = processed_rows
        if error_message is not None:
            import_job.error_message = error_message
        session.commit()

    # Update Redis cache for fast SSE lookups
    cache_job_progress(
        job_id=celery_task_id,
        status=status,
        progress=progress,
        total_rows=total_rows,
        processed_rows=processed_rows,
        error_message=error_message,
    )


@celery_app.task(
    name="app.tasks.product_import.import_products_from_csv",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
)
def import_products_from_csv(self, file_path: str) -> str:
    """
    Stream CSV rows and upsert products by normalized SKU.
    - Batches writes to reduce commit overhead.
    - Tracks progress and updates DB/Redis for real-time updates.
    - Uses context manager to ensure session cleanup even on errors.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    celery_task_id = self.request.id
    session: Session = SessionLocal()

    try:
        # Pre-scan to count total rows for accurate progress
        # This is a fast operation that reads the file once
        total_rows = _count_csv_rows(path)
        
        # Update job status to processing
        _update_job_progress(
            session=session,
            celery_task_id=celery_task_id,
            status=ImportJobStatus.PROCESSING.value,
            progress=0,
            total_rows=total_rows,
            processed_rows=0,
        )

        processed_count = 0

        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for batch in _chunked((_prepare_product_payload(row) for row in reader), settings.batch_size):
                # Deduplicate by SKU within the batch.
                # If the same SKU appears multiple times, the last one wins.
                deduped: dict[str, dict[str, object]] = {}

                for product in batch:
                    if not product["sku"] or not product["name"]:
                        continue
                    deduped[product["sku"]] = product

                if not deduped:
                    continue

                _upsert_batch(session, list(deduped.values()))
                processed_count += len(deduped)

                # Update progress every batch
                # Calculate progress percentage (0-100)
                progress = int((processed_count / total_rows * 100)) if total_rows > 0 else 0
                progress = min(progress, 100)  # Cap at 100%

                _update_job_progress(
                    session=session,
                    celery_task_id=celery_task_id,
                    status=ImportJobStatus.PROCESSING.value,
                    progress=progress,
                    total_rows=total_rows,
                    processed_rows=processed_count,
                )

        # Mark as completed
        _update_job_progress(
            session=session,
            celery_task_id=celery_task_id,
            status=ImportJobStatus.COMPLETED.value,
            progress=100,
            total_rows=total_rows,
            processed_rows=processed_count,
        )

    except Exception as e:
        # Rollback on error to avoid leaving partial data
        session.rollback()
        
        # Mark job as failed with error message
        error_msg = str(e)
        _update_job_progress(
            session=session,
            celery_task_id=celery_task_id,
            status=ImportJobStatus.FAILED.value,
            progress=0,
            error_message=error_msg,
        )
        
        raise
    finally:
        # Always close the session to release the connection back to the pool
        session.close()

    return file_path
