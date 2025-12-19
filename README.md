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

## Frontend Setup (Part 2)

The frontend is a React + Vite + Tailwind application for real-time progress tracking.

### Install Frontend Dependencies
```bash
cd frontend
npm install
```

### Run Frontend Development Server
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000` and will proxy API requests to the backend.

### Build Frontend for Production
```bash
npm run build
```

## Upload flow (Part 1)
1. POST `/api/upload-csv` with a CSV file (streamed to disk).
2. Response returns `job_id` from Celery.
3. Worker streams CSV, normalizes SKU (trim + lower), and upserts in batches.

## Real-time Progress Tracking (Part 2)
1. Upload CSV via the web UI (drag-and-drop or file picker).
2. Frontend connects to SSE endpoint `/api/jobs/{job_id}/events` for real-time updates.
3. Progress bar updates live as rows are processed.
4. Job status updates: pending → processing → completed/failed.

## Product Management (STORY 2)

The application includes a full Product Management UI with CRUD operations:

### Features
- **List Products**: Paginated table view with filtering by SKU, name, description, and active status
- **Create Products**: Add new products with SKU, name, description, and active status
- **Update Products**: Edit product name, description, and active status (SKU cannot be changed)
- **Delete Products**: Delete individual products with confirmation dialog
- **Bulk Delete**: Delete all products at once (requires explicit confirmation)

### API Endpoints

- `GET /api/products` - List products with pagination and filtering
  - Query parameters: `page`, `page_size`, `sku`, `name`, `description`, `active`
- `POST /api/products` - Create a new product
- `GET /api/products/{id}` - Get a single product
- `PUT /api/products/{id}` - Update a product
- `DELETE /api/products/{id}` - Delete a product
- `DELETE /api/products?confirm=true` - Delete all products (bulk delete)

### Usage
Navigate to the "Products" page in the web UI to manage your product catalog.

## Bulk Delete (STORY 3)

The bulk delete feature allows you to delete all products at once:

- Requires explicit confirmation (`confirm=true` parameter)
- Returns the count of deleted products
- Includes strong confirmation dialog in the UI
- Shows success/failure toast notifications

## Webhook Configuration (STORY 4)

Configure webhooks to receive event notifications when products are created, updated, deleted, or when imports complete.

### Features
- **CRUD Operations**: Create, read, update, and delete webhook configurations
- **Enable/Disable**: Toggle webhooks on/off without deleting them
- **Test Webhooks**: Test webhook endpoints with sample payloads
- **Event Types**: Support for `product_created`, `product_updated`, `product_deleted`, `import_completed`

### API Endpoints

- `GET /api/webhooks` - List all webhooks
- `POST /api/webhooks` - Create a new webhook
- `GET /api/webhooks/{id}` - Get a single webhook
- `PUT /api/webhooks/{id}` - Update a webhook
- `DELETE /api/webhooks/{id}` - Delete a webhook
- `POST /api/webhooks/{id}/test` - Test a webhook (returns status code and response time)

### Webhook Payload Format

When events occur, webhooks receive JSON payloads like:

```json
{
  "event_type": "product_created",
  "product_id": "uuid-here",
  "sku": "PRODUCT-SKU",
  "name": "Product Name",
  "timestamp": 1234567890.123
}
```

### Usage
Navigate to the "Webhooks" page in the web UI to configure webhooks. Webhooks are executed asynchronously and do not block the main request flow.

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


