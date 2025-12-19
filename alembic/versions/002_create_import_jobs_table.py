"""create import_jobs table

Revision ID: 002
Revises: 001
Create Date: 2025-12-19 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create import_jobs table for tracking CSV import progress
    op.create_table(
        'import_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('celery_task_id', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('processed_rows', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    
    # Create indexes for efficient queries
    op.create_index('ix_import_jobs_celery_task_id', 'import_jobs', ['celery_task_id'], unique=True)
    op.create_index('ix_import_jobs_status', 'import_jobs', ['status'])
    op.create_index('ix_import_jobs_created_at', 'import_jobs', ['created_at'])


def downgrade() -> None:
    # Drop indexes first, then table
    op.drop_index('ix_import_jobs_created_at', table_name='import_jobs')
    op.drop_index('ix_import_jobs_status', table_name='import_jobs')
    op.drop_index('ix_import_jobs_celery_task_id', table_name='import_jobs')
    op.drop_table('import_jobs')

