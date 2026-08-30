import os
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import all models to ensure they are registered with SQLAlchemy metadata
import app.models.auth  # noqa: F401
import app.models.operations  # noqa: F401
import app.models.catalogs  # noqa: F401
import app.models.component  # noqa: F401
import app.models.base  # noqa: F401

# Get the Base from app.models.base which all models inherit from
from app.models.base import Base

# Application configuration (loads DATABASE_URL from backend/.env)
from app.core.config import settings

# Add model's parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def get_url() -> str:
    # Preserve explicit Alembic override: `-x url=...`
    x_url = context.get_x_argument(as_dictionary=True).get("url")
    if x_url:
        return x_url
    # Use the application's configured DATABASE_URL (from .env via app.core.config)
    return settings.database_url


def run_migrations_offline():
    url = get_url()
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()