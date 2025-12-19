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


@celery_app.task(name="app.tasks.product_import.import_products_from_csv", bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def import_products_from_csv(self, file_path: str) -> str:
    """
    Stream CSV rows and upsert products by normalized SKU.
    - Batches writes to reduce commit overhead.
    - Keeps parsing logic minimal and transparent.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    session: Session = SessionLocal()
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for batch in _chunked((_prepare_product_payload(row) for row in reader), settings.batch_size):
                # Skip rows missing required identifiers; keeps import robust without failing the whole batch.
                filtered = [p for p in batch if p["sku"] and p["name"]]
                if not filtered:
                    continue
                _upsert_batch(session, filtered)
    finally:
        session.close()

    return file_path

