# Product Importer (FastAPI, Celery, PostgreSQL)

## Overview
- FastAPI API for uploading large CSVs and enqueueing background imports.
- Celery worker processes CSV rows in batches, upserting products by normalized SKU.
- PostgreSQL via SQLAlchemy; Alembic-ready project skeleton.

## Prerequisites
- Python 3.11+
- PostgreSQL running and reachable
- Redis for Celery broker/backend

## Setup
```bash
python -m venv .venv
.venv\Scripts\activate  # on Windows
pip install -r requirements.txt
```

Set environment (edit `.env` or export):
```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/product_importer
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
UPLOAD_DIR=uploads
BATCH_SIZE=500
```

## Run API
```bash
uvicorn app.main:app --reload
```

## Run Celery worker
```bash
celery -A app.celery_app.celery_app worker --loglevel=info
```

## Database migrations
- Alembic is wired to `Base.metadata`; generate migrations after models change:
```bash
alembic revision --autogenerate -m "create products"
alembic upgrade head
```

## Upload flow
1. POST `/upload-csv` with a CSV file (streamed to disk).
2. Response returns `job_id` from Celery.
3. Worker streams CSV, normalizes SKU (trim + lower), and upserts in batches.


