from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, HttpUrl


class WebhookBase(BaseModel):
    """Base schema for Webhook with common fields."""
    url: str = Field(..., max_length=500, description="Webhook URL")
    event_type: str = Field(..., max_length=100, description="Event type (e.g., product_created, product_updated, import_completed)")
    enabled: bool = Field(True, description="Whether the webhook is enabled")


class WebhookCreate(WebhookBase):
    """Schema for creating a new webhook."""
    pass


class WebhookUpdate(BaseModel):
    """Schema for updating a webhook (all fields optional)."""
    url: Optional[str] = Field(None, max_length=500)
    event_type: Optional[str] = Field(None, max_length=100)
    enabled: Optional[bool] = None


class WebhookResponse(WebhookBase):
    """Schema for webhook response."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2: allows ORM model conversion


class WebhookTestResponse(BaseModel):
    """Schema for webhook test response."""
    success: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None

