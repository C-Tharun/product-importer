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

    # Note: We normalize SKU (trim + lowercase) before insert in the task,
    # so the unique constraint on sku column is sufficient.
    # The Index with func.lower() syntax doesn't work here - we handle normalization in code.

