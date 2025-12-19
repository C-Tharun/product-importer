import json
from typing import Optional
import redis
from app.core.config import settings

# Create Redis client for caching job progress
# Using Redis for fast lookups during SSE streaming
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def cache_job_progress(job_id: str, status: str, progress: int, total_rows: Optional[int] = None, processed_rows: Optional[int] = None, error_message: Optional[str] = None) -> None:
    """
    Cache job progress in Redis for fast SSE lookups.
    TTL of 1 hour - jobs should complete faster than this.
    """
    data = {
        "status": status,
        "progress": progress,
        "total_rows": total_rows,
        "processed_rows": processed_rows,
        "error_message": error_message,
    }
    redis_client.setex(f"job:{job_id}", 3600, json.dumps(data))  # 1 hour TTL


def get_cached_job_progress(job_id: str) -> Optional[dict]:
    """Get cached job progress from Redis."""
    cached = redis_client.get(f"job:{job_id}")
    if cached:
        return json.loads(cached)
    return None


def delete_cached_job_progress(job_id: str) -> None:
    """Delete cached job progress (cleanup after completion)."""
    redis_client.delete(f"job:{job_id}")

