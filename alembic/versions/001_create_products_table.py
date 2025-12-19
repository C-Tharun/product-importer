"""create products table

Revision ID: 001
Revises: 
Create Date: 2025-12-19 18:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create products table with all required columns
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('sku', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Create unique constraint on sku (case-insensitive uniqueness handled in application code)
    op.create_index('ix_products_sku', 'products', ['sku'], unique=True)
    
    # Create index on sku for faster lookups (already covered by unique index, but explicit for clarity)
    # Note: The unique constraint above already creates an index, but we're being explicit


def downgrade() -> None:
    # Drop the table and all its indexes
    op.drop_index('ix_products_sku', table_name='products')
    op.drop_table('products')

