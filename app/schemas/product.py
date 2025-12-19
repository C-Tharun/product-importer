from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    """Base schema for Product with common fields."""
    sku: str = Field(..., min_length=1, max_length=255, description="Product SKU (unique, case-insensitive)")
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    active: bool = Field(True, description="Whether the product is active")


class ProductCreate(ProductBase):
    """Schema for creating a new product."""
    pass


class ProductUpdate(BaseModel):
    """Schema for updating a product (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    active: Optional[bool] = None


class ProductResponse(ProductBase):
    """Schema for product response."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2: allows ORM model conversion


class ProductListResponse(BaseModel):
    """Schema for paginated product list response."""
    products: list[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

