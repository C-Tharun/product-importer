import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse

router = APIRouter()


def normalize_sku(sku: str) -> str:
    """Normalize SKU: trim whitespace and convert to lowercase for case-insensitive uniqueness."""
    return sku.strip().lower()


@router.get("/products", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sku: Optional[str] = Query(None, description="Filter by SKU (partial match, case-insensitive)"),
    name: Optional[str] = Query(None, description="Filter by name (partial match)"),
    description: Optional[str] = Query(None, description="Filter by description (partial match)"),
    active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
) -> ProductListResponse:
    """
    List products with pagination and filtering.
    Supports filtering by SKU, name, description, and active status.
    """
    # Build query with filters
    query = db.query(Product)

    # Apply filters
    if sku:
        # Case-insensitive partial match on normalized SKU
        normalized_sku = normalize_sku(sku)
        query = query.filter(func.lower(Product.sku).contains(normalized_sku))

    if name:
        # Case-insensitive partial match on name
        query = query.filter(func.lower(Product.name).contains(name.lower()))

    if description:
        # Case-insensitive partial match on description
        query = query.filter(func.lower(Product.description).contains(description.lower()))

    if active is not None:
        query = query.filter(Product.active == active)

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    products = query.order_by(Product.created_at.desc()).offset(offset).limit(page_size).all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return ProductListResponse(
        products=products,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
) -> ProductResponse:
    """
    Create a new product.
    SKU must be unique (case-insensitive).
    """
    # Normalize SKU for uniqueness check
    normalized_sku = normalize_sku(product_data.sku)

    # Check if SKU already exists (case-insensitive)
    existing = db.query(Product).filter(func.lower(Product.sku) == normalized_sku).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Product with SKU '{product_data.sku}' already exists",
        )

    # Create new product with normalized SKU
    product = Product(
        id=uuid.uuid4(),
        sku=normalized_sku,  # Store normalized SKU
        name=product_data.name,
        description=product_data.description,
        active=product_data.active,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ProductResponse:
    """Get a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
) -> ProductResponse:
    """
    Update a product.
    Only updates provided fields (name, description, active).
    SKU cannot be updated (create new product instead).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update only provided fields
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.description is not None:
        product.description = product_data.description
    if product_data.active is not None:
        product.active = product_data.active

    db.commit()
    db.refresh(product)

    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Delete a single product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    return None


@router.delete("/products", status_code=200)
async def delete_all_products(
    confirm: bool = Query(False, description="Must be true to confirm bulk delete"),
    db: Session = Depends(get_db),
) -> dict:
    """
    Delete all products.
    Requires explicit confirmation flag (confirm=true).
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Bulk delete requires confirm=true parameter",
        )

    # Count before deletion
    count = db.query(Product).count()

    # Delete all products
    db.query(Product).delete()
    db.commit()

    return {
        "message": f"Deleted {count} product(s)",
        "deleted_count": count,
    }

