"""create webhooks table

Revision ID: 003
Revises: 002
Create Date: 2025-12-19 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create webhooks table for webhook configuration
    op.create_table(
        'webhooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Create indexes for efficient queries
    op.create_index('ix_webhooks_url', 'webhooks', ['url'])
    op.create_index('ix_webhooks_event_type', 'webhooks', ['event_type'])


def downgrade() -> None:
    # Drop indexes first, then table
    op.drop_index('ix_webhooks_event_type', table_name='webhooks')
    op.drop_index('ix_webhooks_url', table_name='webhooks')
    op.drop_table('webhooks')

