import uuid
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from app.db.session import get_db
from app.models.webhook import Webhook
from app.schemas.webhook import WebhookCreate, WebhookUpdate, WebhookResponse, WebhookTestResponse

router = APIRouter()


@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    db: Session = Depends(get_db),
) -> List[WebhookResponse]:
    """List all webhooks."""
    webhooks = db.query(Webhook).order_by(Webhook.created_at.desc()).all()
    return webhooks


@router.post("/webhooks", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    webhook_data: WebhookCreate,
    db: Session = Depends(get_db),
) -> WebhookResponse:
    """Create a new webhook."""
    webhook = Webhook(
        id=uuid.uuid4(),
        url=webhook_data.url,
        event_type=webhook_data.event_type,
        enabled=webhook_data.enabled,
    )

    db.add(webhook)
    db.commit()
    db.refresh(webhook)

    return webhook


@router.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> WebhookResponse:
    """Get a single webhook by ID."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return webhook


@router.put("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    webhook_data: WebhookUpdate,
    db: Session = Depends(get_db),
) -> WebhookResponse:
    """Update a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Update only provided fields
    if webhook_data.url is not None:
        webhook.url = webhook_data.url
    if webhook_data.event_type is not None:
        webhook.event_type = webhook_data.event_type
    if webhook_data.enabled is not None:
        webhook.enabled = webhook_data.enabled

    db.commit()
    db.refresh(webhook)

    return webhook


@router.delete("/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Delete a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.delete(webhook)
    db.commit()

    return None


@router.post("/webhooks/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> WebhookTestResponse:
    """
    Test a webhook by sending a sample payload.
    Returns response status code and response time.
    Disabled webhooks cannot be tested.
    """
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Check if webhook is enabled before making any HTTP request
    if not webhook.enabled:
        raise HTTPException(
            status_code=400,
            detail="Webhook is disabled. Enable it before testing.",
        )

    # Sample payload for testing
    sample_payload = {
        "event_type": webhook.event_type,
        "test": True,
        "message": "This is a test webhook",
        "timestamp": time.time(),
    }

    try:
        start_time = time.time()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook.url,
                json=sample_payload,
                headers={"Content-Type": "application/json"},
            )
            response_time_ms = (time.time() - start_time) * 1000

            return WebhookTestResponse(
                success=200 <= response.status_code < 300,
                status_code=response.status_code,
                response_time_ms=round(response_time_ms, 2),
            )
    except httpx.TimeoutException:
        return WebhookTestResponse(
            success=False,
            error_message="Request timeout (10s)",
        )
    except Exception as e:
        return WebhookTestResponse(
            success=False,
            error_message=str(e),
        )

