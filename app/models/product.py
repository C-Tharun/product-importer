import uuid
from sqlalchemy import Boolean, Column, DateTime, String, func, Index
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    # Store normalized SKU (trimmed + lowercased) to enforce case-insensitive uniqueness.
    sku = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        # Defensive index to ensure uniqueness on the normalized sku value.
        Index("ix_products_sku_unique", func.lower(sku), unique=True),
    )

