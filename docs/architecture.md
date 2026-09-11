# Architecture

HomeReady AI is a three-tier web application: a Next.js frontend, a
FastAPI backend, and PostgreSQL as the single system of record. An
AI provider sits behind the backend as an explanation layer, never as a
source of truth.

```text
                         Internet
                            |
                            v
                     ┌──────────────┐
                     │   Next.js    │   Browser-facing UI + Route
                     │   Frontend   │   Handlers that proxy every
                     └──────────────┘   backend call
                            |
                          HTTPS
                            |
                            v
                     ┌──────────────┐
                     │   FastAPI    │   Authentication, authorization,
                     │   Backend    │   business logic, the only thing
                     └──────────────┘   that talks to Postgres or S3
                       /     |     \
                      /      |      \
                     v       v       v
              PostgreSQL    S3     AIService
                  |          |      (Anthropic today,
                  |          v       swappable)
                  |        KMS
                  v
             Application
                 data
```

## Why it's split this way

**The frontend never talks to PostgreSQL, S3, or the AI provider
directly.** Every request from the browser goes to the Next.js server
(via its own Route Handlers under `frontend/app/api/`), which forwards it
to FastAPI with the caller's bearer token attached. This keeps the
backend's address, and every credential it holds, out of the browser
entirely - the frontend is a client of the backend's REST API, not a
peer with its own database or provider credentials. It also means the
frontend is not a security boundary: every authorization decision is
re-made on the backend regardless of what the UI shows or hides.

**The backend is the only thing with credentials.** FastAPI holds the
database connection string, the JWT signing secret, the AI provider API
key, and (once implemented) the AWS credentials for S3/KMS. Nothing
downstream of it is trusted to enforce security on its own - PostgreSQL
constraints and Pydantic validation are defense in depth, not the
primary authorization mechanism (see `docs/authorization.md`).

**PostgreSQL is the single source of truth for everything except AI
conversation.** There's no cache, no second datastore, no denormalized
copy anywhere else. A readiness score, once calculated, is a row in
`readiness_results` - not something recomputed on the fly or cached in
a way that could drift from what was actually persisted.

**The AI provider is an explanation layer, not a decision-maker.** It
never calculates a score, never writes to `readiness_results` or
`recommendations`, and never gets direct database access. The backend
retrieves only the specific, already-authorized fields a chat turn needs
and hands them to `AIService` as plain context - see
`docs/ai-architecture.md`.

## Request flow

A typical authenticated request:

```text
Browser
  │  fetch("/api/assessments/123", { headers: { Authorization: bearer } })
  v
Next.js Route Handler (frontend/app/api/assessments/[id]/route.ts)
  │  forwards the Authorization header + calls the backend directly
  │  (BACKEND_INTERNAL_URL, server-to-server - never exposed to the browser)
  v
FastAPI route (backend/app/api/routes/assessments.py)
  │
  ├─ get_current_user      - decode + verify the JWT, re-read the user row
  ├─ require_permission()  - does this role have assessment:read:own?
  ├─ get_owned_assessment  - does this specific row belong to this user?
  │
  v
Service layer (backend/app/services/assessments.py)
  │  parameterized SQL via psycopg 3, no ORM
  v
PostgreSQL
```

Every layer in that chain can reject the request; none of them trust the
one before it blindly. See `docs/authorization.md` for the full
authentication → permission → ownership chain, and `docs/api-design.md`
for the REST conventions every route in this chain follows.

## Backend layout

```text
backend/app/
├── main.py           # FastAPI app assembly - registers every router
├── api/
│   ├── deps.py        # Every FastAPI dependency: get_db, get_current_user,
│   │                   # require_permission(), get_ai_service, get_email_service
│   └── routes/         # One module per resource; thin - no SQL here
├── core/
│   ├── config.py       # Settings (pydantic-settings, reads .env)
│   └── logging.py
├── db/
│   └── connection.py   # psycopg connection pool, commit/rollback semantics
├── schemas/            # Pydantic request/response models (validation lives here)
├── services/           # Business logic + SQL, one module per resource;
│   ├── ai/              # AIService abstraction + provider implementations
│   └── email/            # EmailService abstraction + provider implementations
└── security/            # Password hashing (Argon2id), JWT + opaque token helpers
```

Routes stay thin on purpose: a route function wires together
authentication, authorization, and one or two service calls, then maps
service-layer exceptions to HTTP status codes. All SQL and business rules
live in `services/`, which take a `Connection` as an explicit argument
rather than opening their own - the connection's lifecycle (and its
commit/rollback behavior) is owned entirely by the `get_db` dependency.

## Frontend layout

```text
frontend/
├── app/
│   ├── (marketing)/    # Public pages: home, about, login, register, verify-email
│   ├── (app)/           # Authenticated pages: dashboard, assessments, results,
│   │                     # history, chat, profile - wrapped in an auth guard
│   └── api/              # Route Handlers - the only code allowed to call the
│                          # backend; every one forwards Authorization and never
│                          # leaks BACKEND_INTERNAL_URL to the client bundle
├── components/          # UI components, grouped by feature
├── hooks/
│   └── use-auth.tsx      # Access-token lifecycle: silent refresh, login/logout
└── lib/
    ├── backend.ts         # callBackend() - the one place that knows the backend URL
    ├── types.ts            # TypeScript types matching the backend's JSON responses
    └── format.ts, readiness.ts, cookies.ts
```

The refresh token lives in an httpOnly cookie set by the Route Handlers;
the short-lived access token lives only in a React ref in memory (never
`localStorage`), and `use-auth.tsx` silently refreshes it before it
expires. See `docs/authentication.md` for why the split works this way.

## Data flow through the product

```text
Register + verify email
        │
        v
Create an assessment (DRAFT) ──▶ fill in financials ──▶ submit (SUBMITTED)
        │
        v
Score it (deterministic engine, docs/scoring-methodology.md)
        │
        v
readiness_results + score_breakdowns (immutable, versioned)
        │
        ├──▶ Recommendations (deterministic rules, docs/recommendations.md)
        │
        └──▶ Results/history UI (docs/results.md)
                    │
                    v
              Ask the AI assistant about it (docs/ai-architecture.md)
```

Each arrow is a separate, independently-owned piece: the assessment
service doesn't know how scoring works, the scoring engine doesn't touch
recommendations, and the AI layer only ever reads what's already been
computed. See `docs/README.md` for how the rest of the documentation is
organized around this flow.
