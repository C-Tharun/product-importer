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

### 1. Create Python virtual environment
```bash
python -m venv .venv
.venv\Scripts\activate  # on Windows
pip install -r requirements.txt
```

### 2. Create PostgreSQL database
```bash
# Connect to PostgreSQL (adjust user/password as needed)
psql -U postgres

# Create the database
CREATE DATABASE product_importer;

# Exit psql
\q
```

### 3. Configure environment variables
Create a `.env` file in the project root (or export variables):
```env
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/product_importer
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
UPLOAD_DIR=uploads
BATCH_SIZE=500
```

**Important**: Replace `YOUR_PASSWORD` with your actual PostgreSQL password. The default connection string assumes `postgres:postgres`, but your setup may differ.

## Run API
```bash
uvicorn app.main:app --reload
```

## Run Celery worker
```bash
# On Windows, use --pool=solo (required for Windows)
celery -A app.celery_app.celery_app worker --loglevel=info --pool=solo

# On Linux/Mac, you can use the default pool
celery -A app.celery_app.celery_app worker --loglevel=info
```

## Database migrations

**IMPORTANT**: You must run migrations before the application can work!

The initial migration is already created. Run it with:
```bash
alembic upgrade head
```

To create new migrations after changing models:
```bash
alembic revision --autogenerate -m "description of changes"
alembic upgrade head
```

## Upload flow
1. POST `/upload-csv` with a CSV file (streamed to disk).
2. Response returns `job_id` from Celery.
3. Worker streams CSV, normalizes SKU (trim + lower), and upserts in batches.

## Troubleshooting

### Database connection errors

**Error: `database "product_importer" does not exist`**
- Solution: Create the database (see Setup step 2 above)

**Error: `password authentication failed for user "postgres"`**
- Solution: Update `DATABASE_URL` in `.env` with the correct PostgreSQL password
- Format: `postgresql+psycopg2://USERNAME:PASSWORD@localhost:5432/product_importer`

**Error: `connection to server at "localhost" failed`**
- Check PostgreSQL is running: `pg_isready` (Linux/Mac) or check Windows Services
- Verify port 5432 is accessible
- Check firewall settings

### Celery worker issues

**Task not being picked up**
- Ensure worker is running: `celery -A app.celery_app.celery_app worker --loglevel=info --pool=solo`
- Check Redis is running: `redis-cli ping` (should return `PONG`)
- Verify task is registered: Look for `app.tasks.product_import.import_products_from_csv` in worker startup logs

**Database connection fails in Celery task but works in API**
- Ensure `.env` file is accessible from the worker's working directory
- Restart the Celery worker after changing environment variables
- Check that `DATABASE_URL` is correctly set in the environment where the worker runs


