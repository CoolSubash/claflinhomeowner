# HomeReady AI

HomeReady AI is a production-oriented, AI-assisted application that helps
users understand whether they are financially prepared to pursue
homeownership. Users will be able to create an account, enter financial and
home-buying information, receive a deterministic home-readiness score with a
category breakdown, get improvement recommendations, track their progress
over time, and ask an AI assistant questions about their results.

The application handles sensitive financial information, so security,
privacy, authorization, and auditability are treated as first-class
requirements rather than afterthoughts.

This repository is currently in **Phase 0**: repository and development
foundation only. No application features are implemented yet.

## Technology Stack

- **Frontend:** Next.js, TypeScript, React, Tailwind CSS
- **Backend:** Python, FastAPI, Pydantic, psycopg 3 (raw SQL, no ORM), Alembic
- **Database:** PostgreSQL
- **Auth (planned):** Argon2id password hashing, short-lived access tokens,
  rotating refresh tokens
- **AI:** Provider-agnostic `AIService` abstraction for explanation and
  conversation — not the source of truth for readiness scores
- **Storage (planned):** Private AWS S3 with AWS KMS, short-lived presigned
  URLs
- **Deployment (planned):** Vercel (frontend), Render (backend), GitHub
  Actions (CI/CD)

## High-Level Architecture

```text
Browser → Next.js frontend → HTTPS → FastAPI backend → PostgreSQL / S3 / AIService
```

The frontend never talks to PostgreSQL directly, and all authorization is
enforced on the backend. See `CLAUDE.md` for the full architecture and
security requirements driving this project.

## Repository Structure

```text
.
├── CLAUDE.md              # Project instructions and requirements
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── api/            # Routes and request dependencies
│   │   ├── core/           # Config, logging
│   │   ├── db/              # psycopg connection pool (raw SQL, no ORM)
│   │   ├── models/         # ORM models (added in later phases)
│   │   ├── schemas/        # Pydantic schemas (added in later phases)
│   │   ├── services/       # Business logic (added in later phases)
│   │   └── security/       # Auth/password logic (added in later phases)
│   ├── tests/
│   ├── alembic/             # Migration environment (no migrations yet)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # Next.js application
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── public/
│   └── Dockerfile
└── docs/                    # Architecture and security documentation
```

## Development Phases

This project is built incrementally; only one phase is implemented at a
time. See `CLAUDE.md` for the authoritative phase rules.

- **Phase 0 (current):** Repository structure, tooling, and local
  development foundation only.
- **Later phases:** Authentication, assessments and readiness scoring, AI
  chat, document upload/storage, real-estate professional connections, and
  production deployment — none of these are implemented yet.

## Local Development Prerequisites

- Node.js 20+
- Python 3.12+
- Docker and Docker Compose
- PostgreSQL (via Docker Compose for local development)

To get started, copy the environment template and fill in local-only
values:

```bash
cp .env.example .env
```

See `docker-compose.yml` for the local service definitions (Postgres,
backend, frontend).
