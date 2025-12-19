
# Product Importer

**FastAPI · Celery · PostgreSQL · Redis · React**

## Overview
Product Importer is a full-stack web application designed to efficiently import and manage large product catalogs (up to **500,000+ records**) from CSV files.

The system demonstrates:
- Asynchronous, scalable data ingestion
- Real-time progress tracking
- Complete product management
- Webhook-based event notifications
- Production-grade architecture and deployment ownership

This project was built as part of a **Backend Engineer – Product Importer assignment**, simulating real-world data-flow challenges.

---

## Key Features

### ✅ Asynchronous CSV Import
- Upload large CSV files via UI
- Background processing using Celery
- Batch upserts with PostgreSQL `ON CONFLICT`
- Case-insensitive SKU uniqueness
- Optimized for large datasets

### ✅ CSV Format Validation
- Expected CSV headers: sku, name, description
- Header validation is performed **before** starting the import job
- Validation rules:
- Headers are **case-insensitive**
- Column order does **not** matter
- Extra columns are allowed
- Missing required headers → import is rejected
- Invalid CSV files are rejected immediately with a clear UI error message
- No background job is created for invalid CSV formats



### ✅ Real-Time Progress Tracking
- Live progress updates via Server-Sent Events (SSE)
- Status states: `pending → processing → completed / failed`
- UI progress bar with percentage and row counts

### ✅ Product Management
- Paginated product listing
- Filtering by SKU, name, description, active status
- Create / Update / Delete products
- Inline modal forms with validation
- Case-insensitive SKU enforcement

### ✅ Bulk Delete
- Delete all products in a single operation
- Explicit confirmation required
- Safe, user-protected destructive action
- UI feedback and status notifications

### ✅ Webhook Configuration
- Configure multiple webhooks via UI
- Enable / disable webhooks
- Test webhooks with latency + status feedback
- Asynchronous webhook execution (non-blocking)
- Supports multiple event types

---

## Tech Stack

### Backend
- FastAPI – API framework
- Celery – Background job processing
- Redis – Message broker & cache
- PostgreSQL – Relational database
- SQLAlchemy – ORM
- Alembic – Database migrations

### Frontend
- React + Vite
- Tailwind CSS
- Server-Sent Events (SSE) for live updates

---

## Deployment

### Render (Free Tier)
- Fully publicly accessible deployment

#### Free-Tier Deployment Architecture
Due to Render free-tier limitations (no separate background worker services),
the Celery worker is run **within the same container** as the FastAPI web service.

This approach:
- Preserves asynchronous CSV processing
- Avoids HTTP request timeouts
- Supports real-time progress updates via SSE
- Uses Redis as a message broker
- Remains production-capable for moderate workloads

> In a paid or production environment, the Celery worker would be deployed
> as a separate service for horizontal scalability and fault isolation.

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL
- Redis
- Node.js 18+

### 1. Create Python virtual environment
```
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### 2. Create PostgreSQL database
```
CREATE DATABASE product_importer;
```

### 3. Environment variables
Create a `.env` file in the project root:
```
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/product_importer
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
UPLOAD_DIR=uploads
BATCH_SIZE=500
```

### 4. Run database migrations
```
alembic upgrade head
```

### 5. Run backend API
```
uvicorn app.main:app --reload
```

### 6. Run Celery worker
```
# Windows
celery -A app.celery_app.celery_app worker --loglevel=info --pool=solo

# Linux / macOS
celery -A app.celery_app.celery_app worker --loglevel=info
```

---

## Frontend Setup
```
cd frontend
npm install
npm run dev
```

Frontend runs at:
http://localhost:3000

---

## API Overview

### CSV Import
- POST /api/upload-csv
- GET /api/jobs/{job_id}
- GET /api/jobs/{job_id}/events (SSE)

### Products
- GET /api/products
- POST /api/products
- GET /api/products/{id}
- PUT /api/products/{id}
- DELETE /api/products/{id}
- DELETE /api/products?confirm=true

### Webhooks
- GET /api/webhooks
- POST /api/webhooks
- PUT /api/webhooks/{id}
- DELETE /api/webhooks/{id}
- POST /api/webhooks/{id}/test

#### Webhook payload example
```
{
  "event_type": "product_created",
  "product_id": "uuid",
  "sku": "SKU-001",
  "name": "Product Name",
  "timestamp": 1700000000.123
}
```

---

## Deployment URLs
- Backend API: https://product-importer-api-31e0.onrender.com
- Frontend UI: https://product-importer-frontend-374q.onrender.com

---

## Final Notes
- Long-running imports are handled asynchronously
- No HTTP timeouts for large files
- Clean commit history and modular architecture
- Designed to be easily extended and horizontally scalable

---

### © Tharun Subramanian C
