# HomeReady AI

HomeReady AI is an AI-assisted application that helps users understand
whether they are financially prepared to pursue homeownership. A user
creates an account, enters financial and home-buying information,
receives a deterministic home-readiness score with a category breakdown
and improvement recommendations, tracks their progress over time, and can
ask an AI assistant questions about their results.

The application handles sensitive financial information, so security,
privacy, authorization, and auditability are treated as first-class
requirements rather than afterthoughts.

## What's implemented

- Account registration with mandatory email verification, login,
  short-lived JWT access tokens, rotating refresh tokens
- Role-based access control (RBAC) with granular permissions, enforced
  alongside per-resource ownership checks on every protected endpoint
- Assessments: create, edit, submit, and a deterministic, versioned
  readiness-scoring engine
- Results, history, and a deterministic rule-based recommendation engine
- An AI chat assistant (Claude via AWS Bedrock, or direct Anthropic) that
  explains a user's results (never calculates or changes them)
- Invite-only realtor onboarding, an admin dashboard (manage users, vet
  and onboard realtors), and a realtor dashboard (respond to connection
  requests) - see `docs/realtor-onboarding.md`
- A full frontend for every feature above (dashboard, assessments,
  results, history, chat, profile, admin, realtor)

**Not yet implemented:** document upload/storage (S3/KMS - schema
exists, no upload code), a homebuyer-facing "request a realtor
connection" flow (the realtor side is built; nothing creates the request
yet), and production deployment (see `docs/deployment.md`).

## Documentation

Start at [`docs/README.md`](docs/README.md) - it indexes every document
in reading order, from system architecture through to deployment. A few
entry points:

- [`docs/architecture.md`](docs/architecture.md) - how the system is put together
- [`docs/database.md`](docs/database.md) - the full schema
- [`docs/authorization.md`](docs/authorization.md) - RBAC and ownership checks
- [`docs/api-design.md`](docs/api-design.md) - the full REST API reference
- [`docs/security.md`](docs/security.md) / [`docs/threat-model.md`](docs/threat-model.md) - security posture and threats
- [`docs/deployment.md`](docs/deployment.md) - running it locally and shipping it

The documentation can also be built into a single PDF - see
[`scripts/docs-pdf/README.md`](scripts/docs-pdf/README.md).

## Technology Stack

- **Frontend:** Next.js, TypeScript, React, Tailwind CSS
- **Backend:** Python, FastAPI, Pydantic, psycopg 3 (raw SQL, no ORM), Alembic
- **Database:** PostgreSQL
- **Auth:** Argon2id password hashing, short-lived JWT access tokens,
  rotating refresh tokens, mandatory email verification (`docs/authentication.md`)
- **AI:** Provider-agnostic `AIService` abstraction — Claude via AWS
  Bedrock by default, or the direct Anthropic API — for explanation and
  conversation, never the source of truth for readiness scores
  (`docs/ai-architecture.md`)
- **Storage (planned):** Private AWS S3 with AWS KMS, short-lived presigned URLs
- **Deployment:** Vercel (frontend), Render (backend) — see `docs/deployment.md`

## High-Level Architecture

```text
Browser → Next.js frontend → HTTPS → FastAPI backend → PostgreSQL / S3 / AIService
```

The frontend never talks to PostgreSQL directly, and all authorization is
enforced on the backend. See `docs/architecture.md` for the full picture.

## Repository Structure

```text
.
├── README.md
├── CLAUDE.md               # Project instructions this codebase was built against
├── .gitignore
├── .env.example
├── docker-compose.yml
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── api/              # Routes and request dependencies
│   │   ├── core/             # Config, logging
│   │   ├── db/                 # psycopg connection pool (raw SQL, no ORM)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic - auth, assessments, scoring,
│   │   │   ├── ai/               # AIService abstraction + providers
│   │   │   └── email/             # EmailService abstraction + providers
│   │   └── security/            # Password hashing (Argon2id), token helpers
│   ├── tests/
│   ├── alembic/               # Migrations - source of truth for the schema
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js application
│   ├── app/                    # (marketing)/, (app)/, api/ (backend proxy routes)
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── Dockerfile
├── docs/                      # Start at docs/README.md
└── scripts/
    └── docs-pdf/                # Builds docs/ into one PDF
```

## Local Development

- Node.js 20+
- Python 3.12+
- Docker and Docker Compose (or any Postgres 16 instance)

```bash
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, etc.

docker compose up -d postgres

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# separate terminal
cd frontend
npm install
npm run dev
```

Full detail, including the recommended production setup, is in
`docs/deployment.md`.
