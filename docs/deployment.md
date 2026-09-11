# Deployment

**Status: not yet deployed anywhere.** This document describes how to run
the application locally today, and the recommended path to a first
production deployment. Nothing below has been executed against a real
Vercel/Render account - treat the production section as a plan to follow,
not a record of what's already live.

## Local development

The fastest path is running backend and frontend directly (not through
Docker), against a Postgres instance provided either way:

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, etc.

# Database (either works)
docker compose up -d postgres
# ...or point DATABASE_URL at any Postgres 16 instance you already have

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

`docker-compose.yml` can also run all three services (`postgres`,
`backend`, `frontend`) together with `docker compose up`. Its
`backend`/`frontend` Dockerfiles are dev-mode images (`uvicorn --reload`,
`npm run dev` with the source tree bind-mounted in) - convenient for a
consistent local environment, but not what should run in production (see
"Before deploying to production" below).

## Recommended production architecture

This matches the stack the project was designed against from the start:

```text
Vercel (Next.js frontend)
        │  HTTPS, BACKEND_INTERNAL_URL
        v
Render (FastAPI backend, web service)
        │
        v
Managed PostgreSQL (Render Postgres, RDS, Supabase, etc.)
```

**Frontend → Vercel.** A standard Next.js deployment: connect the repo,
set the root directory to `frontend/`, and set `BACKEND_INTERNAL_URL` to
the backend's public Render URL. `NEXT_PUBLIC_API_URL` stays unused
(unset or empty) - the frontend never calls the backend from the browser,
only from its own server-side Route Handlers (see `docs/architecture.md`).

**Backend → Render.** A Render web service built from `backend/`, using
a production-appropriate start command rather than the dev Dockerfile's
`--reload`:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
```

**Database → a managed Postgres instance**, not a container Render (or
any host) restarts alongside the app. Render Postgres, RDS, or Supabase
all work; what matters is that its data survives backend redeploys and
that the connecting role is least-privileged (see below).

## Environment variables

Every variable the backend reads is listed in `.env.example`; the ones
that matter for a production deploy specifically:

| Variable | Production guidance |
|---|---|
| `DATABASE_URL` | Points at the managed Postgres instance, `sslmode=require` |
| `JWT_SECRET` | Long, random, generated fresh for production - never the same value used locally |
| `REFRESH_TOKEN_EXPIRE_DAYS`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Defaults (30 days / 15 minutes) are reasonable starting points |
| `FRONTEND_BASE_URL` | The real Vercel URL - used to build email verification links |
| `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL` | Set to enable the AI assistant; the app runs fine without it (see `docs/ai-architecture.md`) |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_KMS_KEY_ID` | Not yet used by any implemented feature - reserved for document upload |
| `BACKEND_INTERNAL_URL` (frontend) | The backend's Render URL, set in Vercel's project settings |

None of these belong in the repository. `.env` is gitignored;
`.env.example` carries names and placeholders only.

## Migrations

Alembic owns the schema (`docs/database.md`). Before or during a deploy:

```bash
alembic upgrade head
```

Render's deploy hooks (or a manual step run once per release) should run
this against the production database before the new backend version
starts serving traffic - the schema must be ready before the code that
assumes it exists goes live.

## Before deploying to production

The current Dockerfiles and local setup are dev-oriented. Before a real
production deploy, this list should be worked through - none of it is
done yet:

- **Production Dockerfile for the backend**: drop `--reload`, add
  `--workers`, don't bind-mount the source tree.
- **Production build for the frontend**: `next build` + `next start`
  (or let Vercel handle this automatically), not `next dev`.
- **Least-privileged database role**: the application must not connect
  as a Postgres superuser - create a role scoped to the application's
  schema only, separate from the role Alembic migrations run as if that
  role needs elevated `CREATE`/`ALTER` rights.
- **Separate databases per environment**: development, staging, and
  production should never share a Postgres instance or connection string.
- **Secrets in the platform's secret manager**: Render/Vercel environment
  variable settings, not committed files, not shell history.
- **CORS**: currently a non-issue because the frontend never calls the
  backend from the browser (see `docs/architecture.md`) - if that ever
  changes, CORS needs explicit configuration then, not before.
- **HTTPS everywhere**: both Vercel and Render provide this by default;
  confirm cookies are set with `Secure` in that environment
  (`frontend/lib/cookies.ts` already conditions this on `NODE_ENV`).
- **CI (GitHub Actions)**: not yet set up. The recommended minimum is a
  workflow that runs `pytest` (backend) and `npm run lint` + `npm run
  build` (frontend) on every pull request, before any deploy step.

## What's not covered here

Document storage (S3/KMS) has schema and planned environment variables
but no implemented upload/download code yet, so there's nothing to deploy
for it. See `docs/database.md`'s migration status table for what's schema
only versus fully implemented.
