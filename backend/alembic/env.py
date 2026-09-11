from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings

# NOTE: Alembic's migration runner is itself built on SQLAlchemy's engine
# and dialect layer (op.execute() is implemented on top of it) - that is
# Alembic's own internal dependency, unrelated to this project's data
# access layer. The application never imports SQLAlchemy: there are no
# models, no ORM, and no application-level engine/session. All schema is
# defined as explicit, hand-written SQL inside migration files, and the
# app talks to PostgreSQL only through psycopg (see app/db/connection.py).

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
if settings.database_url:
    # DATABASE_URL is a plain "postgresql://" URL used directly by our own
    # psycopg connection layer. SQLAlchemy's engine (Alembic's own runner,
    # not ours) needs the dialect made explicit as psycopg 3, since psycopg2
    # is not installed in this project.
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    config.set_main_option("sqlalchemy.url", url)

# No ORM metadata: schema is defined by migrations, not Python models.
target_metadata = None


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
