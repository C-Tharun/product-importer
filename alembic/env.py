import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# -------------------------------------------------
# Ensure project root is on PYTHONPATH
# -------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))  # Use insert to prioritize your project path

# -------------------------------------------------
# Import app settings and metadata
# -------------------------------------------------
from app.core.config import settings
from app.db.base import Base
# Import all models so Alembic can discover them
from app.models import Product, ImportJob  # noqa: F401

# -------------------------------------------------
# Alembic Config object
# -------------------------------------------------
config = context.config

# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# -------------------------------------------------
# Database URL (from settings/database environment variable)
# -------------------------------------------------
config.set_main_option("sqlalchemy.url", settings.database_url)

# Metadata for autogenerate
target_metadata = Base.metadata


# -------------------------------------------------
# Offline migrations
# -------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations without a live database connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# -------------------------------------------------
# Online migrations
# -------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations with a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # detect column type changes
        )

        with context.begin_transaction():
            context.run_migrations()


# -------------------------------------------------
# Run the migrations
# -------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
