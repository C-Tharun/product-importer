import csv
from pathlib import Path
from typing import Iterable, List, Dict

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.db.session import SessionLocal
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
    - Keeps parsing logic minimal and transparent.
    - Uses context manager to ensure session cleanup even on errors.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    # Create a new session for this task
    # Each Celery worker process needs its own DB connection
    session: Session = SessionLocal()
    try:
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
    except Exception as e:
        # Rollback on error to avoid leaving partial data
        session.rollback()
        raise
    finally:
        # Always close the session to release the connection back to the pool
        session.close()

    return file_path
