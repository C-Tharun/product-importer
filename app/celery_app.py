from celery import Celery
from app.core.config import settings

# Default to Redis URL when explicit Celery URLs are not provided.
broker_url = settings.celery_broker_url or settings.redis_url
result_backend = settings.celery_result_backend or settings.redis_url

celery_app = Celery(
    "product_importer_worker",
    broker=broker_url,
    backend=result_backend,
)

# IMPORTANT: tell Celery where to find tasks
celery_app.autodiscover_tasks(["app.tasks"])

celery_app.conf.task_routes = {
    "app.tasks.product_import.*": {"queue": "imports"},
}

celery_app.conf.task_default_queue = "imports"
