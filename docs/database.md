# Database

The primary application database is PostgreSQL. There is no ORM: the
application talks to PostgreSQL directly through raw, parameterized SQL,
and the schema is owned entirely by Alembic migrations.

```text
FastAPI
   ↓
psycopg 3
   ↓
Raw SQL
   ↓
PostgreSQL

Alembic
   ↓
Database migrations
   ↓
PostgreSQL schema
```

- `app/db/connection.py` owns a `psycopg_pool.ConnectionPool` and exposes a
  `get_connection()` context manager (commit on success, rollback on
  exception). It contains no application-specific queries.
- Services/routes execute parameterized SQL directly against the borrowed
  connection — never string-interpolated SQL.
- The schema (tables, columns, constraints, indexes) is defined entirely by
  hand-written SQL inside `alembic/versions/*.py` migrations
  (`op.execute("""...""")`). There is no `Base.metadata.create_all()` and
  no autogenerate from ORM models.

The concrete application schema (users, assessments, readiness results,
etc.) will be added as migrations in the phase that introduces those
features — see `CLAUDE.md` for the target entity list.
