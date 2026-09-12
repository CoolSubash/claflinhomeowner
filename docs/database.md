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

## Data access layer

- `app/db/connection.py` owns a `psycopg_pool.ConnectionPool` and exposes a
  `get_connection()` context manager (commits on success, rolls back on
  exception, always returns the connection to the pool). It contains no
  application-specific queries.
- `app/api/deps.py` exposes `get_db()`, a FastAPI dependency wrapping
  `get_connection()` for use with `Depends(get_db)` in routes.
- Query functions live in `app/services/<entity>.py` and take a `Connection`
  as an argument — routes stay thin, services own the SQL. Routes never
  embed SQL directly.
- Services/routes execute parameterized SQL only (`cur.execute("... %s", (value,))`)
  — never string-interpolated or f-string SQL.
- The schema (tables, columns, constraints, indexes, triggers, extensions)
  is defined entirely by hand-written SQL inside `alembic/versions/*.py`
  migrations (`op.execute("""...""")`). There is no `Base.metadata.create_all()`
  and no autogenerate from ORM models — Alembic only ever runs the SQL we
  write by hand.

## Conventions

- **Primary keys:** `UUID` generated with `gen_random_uuid()` (built into
  PostgreSQL 16, no extension required), not auto-incrementing integers.
  Sequential integer IDs are easy to enumerate in URLs/API responses,
  which is exactly the kind of thing that invites IDOR probing (see
  `docs/threat-model.md`) — UUIDs don't fix authorization on their own,
  but they remove free enumeration as an attack vector.
- **Timestamps:** `TIMESTAMPTZ`, defaulting to `now()`. Every table has
  `created_at`; mutable tables also have `updated_at`, kept current by a
  shared `set_updated_at()` trigger function (see the `users` migration)
  rather than being set from application code.
- **Foreign keys:** always `ON DELETE` explicit (`CASCADE` for
  strictly-owned child rows like `score_breakdowns`, `RESTRICT`/`NO ACTION`
  where accidental cascading deletion would be dangerous, e.g. deleting a
  user should not silently be allowed to cascade through financial history
  without an explicit decision).
- **Ownership column:** every user-owned table carries `user_id` directly
  (even when reachable transitively through a parent), so authorization
  checks (`resource.user_id == current_user.id`) never require a join
  just to enforce ownership. This is why `score_breakdowns`,
  `recommendations`, and `chat_messages` carry `user_id` even though it is
  also derivable via `readiness_result_id`/`session_id` — a direct column
  means a row-level ownership filter never depends on getting a join right.
- **Enum-like columns:** status/role/category columns are `VARCHAR` with an
  explicit `CHECK` constraint listing the allowed values (e.g.
  `assessments.status`, `readiness_results.status`,
  `chat_messages.role`), not a Postgres `ENUM` type — plain `VARCHAR` is
  easier to extend later without an `ALTER TYPE` migration, while the
  `CHECK` still gives DB-level validation as defense in depth alongside
  Pydantic validation in the application layer.
- **Foreign key indexes:** PostgreSQL does not automatically index foreign
  key columns, so every FK column that is queried directly (`user_id`,
  parent-entity ids) has an explicit `ix_` index.
- **Naming:** tables and columns are `snake_case`; indexes are prefixed
  `ix_`, unique indexes/constraints `uq_`, foreign keys are unnamed
  inline `REFERENCES` constraints (PostgreSQL auto-names them
  `<table>_<column>_fkey`).
- **Migration files:** one migration per logical schema change, named by
  Alembic's revision id + a short slug (e.g. `43c68d6abb7c_create_users_table.py`).
  Every `upgrade()` has a corresponding `downgrade()` that fully reverses it.

## Implementation status

The schema was built ahead of most of the application code that uses
it — every table below exists in the database today, but not every table
has a full API and UI built on top of it yet.

| Table | Status | Migration |
|---|---|---|
| `users` | Fully implemented | `43c68d6abb7c_create_users_table.py` |
| `roles`, `permissions`, `user_roles`, `role_permissions` | Fully implemented | `a0c751054685_create_roles_and_permissions_tables.py` |
| `refresh_tokens` | Fully implemented | `e8c6f1ddb21f_create_refresh_tokens_table.py` |
| `email_verification_tokens` | Fully implemented | `5c4803c01e8b_create_email_verification_tokens_table.py` |
| `scoring_versions` | Fully implemented (schema `e57b12790ccc`; `v1` seeded by `3d5368a4a92f`) | `e57b12790ccc_create_scoring_versions_table.py` |
| `assessments` | Fully implemented (schema + full CRUD/submit API + UI) | `40ab8825fa3e_create_assessments_table.py` |
| `readiness_results`, `score_breakdowns` | Fully implemented (schema + scoring engine/API; `explanation` column + idempotency index added by `ccfdce7b23e5`) | `81b554a986a8_create_readiness_results_tables.py` |
| `recommendations` | Fully implemented (schema + deterministic rule engine + API; idempotency index added by `484310a89338`) | `6d6a93a0acc1_create_recommendations_table.py` |
| `chat_sessions`, `chat_messages` | Fully implemented (schema + AI chat service/API/UI) | `2c200096d5cb_create_chat_tables.py` |
| `files`, `file_extractions` | Schema only — no upload/processing code yet | `5a539c7a2e33_create_files_tables.py` |
| `real_estate_partners`, `realtor_invitations` | Fully implemented (onboarding API/UI - `docs/realtor-onboarding.md`; `user_id` link + invitations table added by `189078b0fd76`) | `3f83a149589a_create_real_estate_tables.py` |
| `connection_requests` | Realtor-side read/respond implemented; no homebuyer-side create endpoint yet | `3f83a149589a_create_real_estate_tables.py` |
| `audit_logs` | Fully implemented | `59cb86819d86_create_audit_logs_table.py` |
| `testimonials` | Fully implemented (schema + API + homepage UI) | `5e5ad50add74_create_testimonials_table_and_permission.py` |

Every migration has been verified end-to-end against a live PostgreSQL 16
instance: `alembic upgrade head` applies cleanly, `alembic downgrade
base` fully reverses every table/trigger/index back to zero application
tables, and re-running `upgrade head` is clean and idempotent. `CHECK`
constraints (e.g. `assessments.status`, `readiness_results.status`) and
the partial unique index on `scoring_versions.is_active` reject invalid
data at the database level, independent of application-layer validation.

## Entity relationship overview

```text
users ──< user_roles >── roles ──< role_permissions >── permissions
  │
  ├──< refresh_tokens
  ├──< email_verification_tokens
  ├──< assessments ──< readiness_results ──< score_breakdowns
  │         │                   │
  │         │                   └──< recommendations
  │         │
  │         └── (assessment_id nullable FK from files, chat_sessions)
  │
  ├──< chat_sessions ──< chat_messages
  ├──< files ── file_extractions (1:1)
  ├──< connection_requests >── real_estate_partners
  ├── (real_estate_partners.user_id - one onboarded login per partner)
  ├──< audit_logs
  └──< testimonials

scoring_versions ──< readiness_results   (referenced, never mutated)
real_estate_partners ──< realtor_invitations
```

## Tables

### `users`

Core account record. Never stores a plaintext password — only an Argon2id
hash (`docs/authentication.md`).

```text
id              UUID PK
email           VARCHAR(320) NOT NULL      -- unique, case-insensitive (LOWER(email))
password_hash   TEXT NOT NULL
first_name      VARCHAR(100) NOT NULL
last_name       VARCHAR(100) NOT NULL
is_active       BOOLEAN NOT NULL DEFAULT true
email_verified  BOOLEAN NOT NULL DEFAULT false
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()   -- kept current by trigger
last_login_at   TIMESTAMPTZ
```

### `roles`, `permissions`, `user_roles`, `role_permissions`

The RBAC tables (`docs/authorization.md`). Roles are coarse (`USER`,
`ADMIN`, `SUPPORT`, `REALTOR`, a future `SUPER_ADMIN`); authorization
decisions are made on granular permission strings
(`assessment:read:own`, `file:delete:own`, ...), not on role-name checks
scattered through the app.

```text
roles
-----
id            UUID PK
name          VARCHAR(50) NOT NULL UNIQUE     -- e.g. "ADMIN"
description   TEXT
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

permissions
-----------
id            UUID PK
key           VARCHAR(100) NOT NULL UNIQUE    -- e.g. "assessment:read:own"
description   TEXT
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

user_roles
----------
user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
PRIMARY KEY (user_id, role_id)

role_permissions
-----------------
role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE
permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
PRIMARY KEY (role_id, permission_id)
```

RBAC alone is not sufficient — every route also enforces row-level
ownership (`resource.user_id == current_user.id`) in addition to the
permission check; see `docs/authorization.md`.

### `refresh_tokens`

Backs rotating refresh-token authentication (`docs/authentication.md`):
cryptographically random, hashed before storage, revocable, rotated on
every use, and tied to the session that issued it.

```text
id              UUID PK
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash      TEXT NOT NULL UNIQUE       -- hash only, never the raw token
issued_at       TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at      TIMESTAMPTZ NOT NULL
revoked_at      TIMESTAMPTZ                -- null while active
replaced_by_id  UUID REFERENCES refresh_tokens(id)   -- rotation chain
user_agent      TEXT
ip_address      INET
```

### `email_verification_tokens`

Same design as `refresh_tokens`, for the account-verification link a new
user must click before they can log in (`docs/authentication.md`).

```text
id            UUID PK
user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_hash    VARCHAR(64) NOT NULL UNIQUE   -- SHA-256 hash only
expires_at    TIMESTAMPTZ NOT NULL
used_at       TIMESTAMPTZ                    -- null while unused; single-use once set
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `scoring_versions`

Scoring is versioned, and a historical result must never silently change
when the methodology changes later (`docs/scoring-methodology.md`).

```text
id            UUID PK
version       VARCHAR(20) NOT NULL UNIQUE   -- e.g. "v1.0"
weights       JSONB NOT NULL                -- category -> weight, sums to 1.0
thresholds    JSONB NOT NULL                -- status -> [min, max] score range
is_active     BOOLEAN NOT NULL DEFAULT false -- exactly one row true at a time
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

Rows in this table are append-only in practice: a new methodology is a new
row, never an edit to an existing version, because `readiness_results`
pins `scoring_version_id` and must keep reproducing the score it produced
at the time. A partial unique index,
`uq_scoring_versions_one_active ON scoring_versions ((is_active)) WHERE
is_active = true`, enforces at the database level that at most one row is
active at a time — verified directly: a second `is_active = true` insert
is rejected with a unique-violation error.

The `v1` row's `weights`/`thresholds` JSON is a read-only reference/audit
snapshot of the methodology described in `docs/scoring-v1.md` — the
executable source of truth is `backend/app/services/scoring.py`'s
`WEIGHTS`/`READINESS_BANDS` constants, never this row read back into a
calculation.

### `assessments`

User-entered inputs for a single readiness evaluation
(`docs/assessments.md`).

```text
id                  UUID PK
user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','SUBMITTED','PROCESSING','COMPLETED','FAILED'))
income              NUMERIC(12,2)
monthly_debt        NUMERIC(12,2)
credit_score        SMALLINT
savings             NUMERIC(12,2)
down_payment        NUMERIC(12,2)
target_home_price   NUMERIC(12,2)
employment_years    NUMERIC(4,1)
location             TEXT
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
submitted_at        TIMESTAMPTZ
```

### `readiness_results` / `score_breakdowns`

The deterministic scoring output for a submitted assessment, and its
per-category breakdown (`docs/scoring-v1.md`). Immutable once created — a
recalculation creates a new row, it never edits an old one.

```text
readiness_results
------------------
id                   UUID PK
assessment_id        UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE
user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
scoring_version_id   UUID NOT NULL REFERENCES scoring_versions(id) ON DELETE RESTRICT
overall_score        SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100)
status               VARCHAR(20) NOT NULL
                        CHECK (status IN ('NOT_READY','NEEDS_IMPROVEMENT','ALMOST_READY','READY','HIGHLY_READY'))
created_at           TIMESTAMPTZ NOT NULL DEFAULT now()

score_breakdowns
-----------------
id                    UUID PK
readiness_result_id   UUID NOT NULL REFERENCES readiness_results(id) ON DELETE CASCADE
user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
category              VARCHAR(50) NOT NULL
                         CHECK (category IN ('financial_stability','debt_management','down_payment',
                                              'credit','savings','employment_stability'))
raw_value             NUMERIC(12,2)
category_score        SMALLINT NOT NULL CHECK (category_score BETWEEN 0 AND 100)
weight                NUMERIC(4,3) NOT NULL   -- e.g. 0.250
explanation           TEXT NOT NULL DEFAULT ''
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

A unique index, `uq_readiness_results_assessment_scoring_version ON
readiness_results (assessment_id, scoring_version_id)`, enforces "one
canonical result per assessment per scoring version" at the database
level — a second `POST /assessments/{id}/score` for the same pair cannot
insert a duplicate row (`docs/scoring-methodology.md`).

`explanation` is generated once, at scoring time, by
`app/services/scoring.py::explanation_for` and stored alongside the score
it describes — it is deliberately *not* recomputed from a template at
read time, because a future wording change to that template would
otherwise silently alter how an already-frozen historical result reads,
which would violate the same historical-immutability guarantee as
changing its score.

`scoring_version_id` uses `ON DELETE RESTRICT`: a scoring version can
never be deleted while any `readiness_results` row still references it,
since that would break the "historical results never silently change"
guarantee.

### `recommendations`

Generated deterministically from a `readiness_results` row's category
breakdown (`docs/recommendations.md`). The AI layer may explain these in
conversation but never writes to this table.

```text
id                    UUID PK
readiness_result_id   UUID NOT NULL REFERENCES readiness_results(id) ON DELETE CASCADE
user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
category              VARCHAR(50) NOT NULL
priority              VARCHAR(10) NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH'))
title                 VARCHAR(200) NOT NULL
description           TEXT NOT NULL
source                VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (source IN ('system','ai'))
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```

A unique index on `(readiness_result_id, category)` makes generation
idempotent — repeated requests for the same result's recommendations
never create duplicate rows (`docs/recommendations.md`).

### `chat_sessions` / `chat_messages`

AI conversation history, scoped to a user and optionally an assessment
(`docs/ai-architecture.md`). The AI never receives raw database access —
the backend retrieves and hands it only the minimum relevant context for
a given message.

```text
chat_sessions
--------------
id             UUID PK
user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
title          VARCHAR(200)
assessment_id  UUID REFERENCES assessments(id) ON DELETE SET NULL
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()

chat_messages
--------------
id             UUID PK
session_id     UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE
user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
role           VARCHAR(10) NOT NULL CHECK (role IN ('USER','ASSISTANT','SYSTEM'))
content        TEXT NOT NULL
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `files` / `file_extractions`

Schema only — no upload or processing code exists yet. Metadata is
designed to live here while the actual bytes live in private S3, never
in Postgres. `storage_key` is generated by the backend and is not, on its
own, an authorization mechanism — ownership will need to be re-checked
before any presigned URL is issued, once this is built.

```text
files
------
id                  UUID PK
user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
assessment_id       UUID REFERENCES assessments(id) ON DELETE SET NULL
chat_session_id     UUID REFERENCES chat_sessions(id) ON DELETE SET NULL
original_filename   VARCHAR(255) NOT NULL   -- display only, never trusted for paths
storage_key         TEXT NOT NULL UNIQUE    -- users/{user_id}/assessments/{assessment_id}/files/{file_id}
content_type        VARCHAR(100) NOT NULL
file_size           BIGINT NOT NULL
processing_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (processing_status IN ('PENDING','PROCESSING','COMPLETED','FAILED'))
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()

file_extractions
------------------
id                  UUID PK
file_id             UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE   -- UNIQUE: 1:1 with files
user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
extracted_text      TEXT
structured_data     JSONB
processing_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (processing_status IN ('PENDING','PROCESSING','COMPLETED','FAILED'))
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `real_estate_partners` / `connection_requests` / `realtor_invitations`

An optional, explicit-consent connection to a real-estate professional,
with no financial data shared automatically. Onboarding a realtor
(`docs/realtor-onboarding.md`) is implemented; a homebuyer actually
*creating* a `connection_requests` row is not (see that doc's "What's not
built yet").

```text
real_estate_partners
----------------------
id              UUID PK
name            VARCHAR(200) NOT NULL
contact_email   VARCHAR(320)
contact_phone   VARCHAR(30)
is_active       BOOLEAN NOT NULL DEFAULT true
user_id         UUID REFERENCES users(id) ON DELETE SET NULL   -- the onboarded login, once one exists
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

connection_requests
----------------------
id                  UUID PK
user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
partner_id          UUID NOT NULL REFERENCES real_estate_partners(id) ON DELETE RESTRICT
status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
consent_given_at    TIMESTAMPTZ NOT NULL   -- explicit consent record, required
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()

realtor_invitations
----------------------
id            UUID PK
partner_id    UUID NOT NULL REFERENCES real_estate_partners(id) ON DELETE CASCADE
email         VARCHAR(320) NOT NULL
token_hash    VARCHAR(64) NOT NULL UNIQUE   -- SHA-256 hash only, same design as email_verification_tokens
invited_by    UUID REFERENCES users(id) ON DELETE SET NULL
expires_at    TIMESTAMPTZ NOT NULL
used_at       TIMESTAMPTZ                    -- null while unused; single-use once set
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

`real_estate_partners.user_id` has a unique index (partial, `WHERE user_id
IS NOT NULL`) - one login per partner record. `ON DELETE SET NULL`
rather than `CASCADE`: deleting the onboarded user should never delete
the vetted partner record itself.

### `audit_logs`

Sensitive-operation trail (`docs/security.md`). Append-only — no update
path. Never logs passwords, JWTs, refresh tokens, API keys, AWS
credentials, or full financial documents.

```text
id             UUID PK
user_id        UUID REFERENCES users(id) ON DELETE SET NULL   -- nullable: actor may be deleted later
action         VARCHAR(50) NOT NULL   -- e.g. USER_LOGIN, ASSESSMENT_CREATED, ROLE_CHANGED
resource_type  VARCHAR(50)
resource_id    UUID
ip_address     INET
user_agent     TEXT
metadata       JSONB
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `testimonials`

Backs the homepage's "What people are saying" section. One row per
account (`uq_testimonials_user_id`), gated by the `testimonial:create`
permission (`USER` and `REALTOR` only — see `docs/authorization.md`).
Only rows with `rating >= 4` are ever returned by the public
`GET /api/v1/testimonials/featured` endpoint, and only the author's first
name + last initial is exposed — never the account's email or full name.

```text
id            UUID PK
user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5)
content       VARCHAR(500) NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

## Security notes

- Every table involved in a request is filtered by `user_id` at the query
  level for non-admin access — RBAC permission checks are necessary but
  not sufficient (`docs/authorization.md`).
- All values are passed as query parameters (`%s` placeholders); SQL is
  never built by string concatenation or f-strings.
- The application is expected to connect with a least-privileged database
  role in production, never a superuser — see `docs/deployment.md`.
- `docs/security.md` and `docs/threat-model.md` cover authentication,
  authorization, and injection/IDOR/BOLA threats in more depth; this
  document is schema, not threat modeling.
