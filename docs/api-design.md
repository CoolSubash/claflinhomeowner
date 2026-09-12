# API Design

REST conventions and the full endpoint surface. This is the reference for
"what exists and what does it need" across every resource; each feature's
own document (`docs/assessments.md`, `docs/authentication.md`, ...)
covers the request/response bodies, error cases, and business rules for
its endpoints in depth - this page is the map, not the territory.

## Conventions

**Base path**: every endpoint is versioned under `/api/v1/`. There is no
unversioned API surface.

**Authentication**: every endpoint except `POST /auth/register`,
`POST /auth/login`, `POST /auth/verify-email`,
`POST /auth/resend-verification`, `POST /auth/refresh`,
`POST /realtor-invitations/lookup`, `POST /realtor-invitations/accept`,
`GET /health`, and `GET /testimonials/featured` requires
`Authorization: Bearer <access_token>`. A missing or invalid token
returns `401`.

**Authorization**: most endpoints additionally require a specific
permission (`assessment:create`, `chat:read:own`, ...), checked after
authentication and before any database query. Missing the permission
returns `403`. See `docs/authorization.md` for the full permission list
and how roles map to them.

**Ownership**: an ID in the URL is never trusted just because it's a
valid UUID - every resource lookup filters by the authenticated caller's
`user_id` in the same query. A resource that doesn't exist and one that
belongs to someone else both return the identical `404` (see
`docs/authorization.md`'s IDOR strategy).

**Request/response shape**: JSON in, JSON out. Every request body is
validated by a Pydantic schema before it reaches business logic; an
invalid body returns `422` with field-level detail. Decimal-typed fields
(money, `employment_years`) are serialized as JSON strings (`"72000.00"`)
to preserve exact precision - never as floating-point numbers.

**Errors**: always `{"detail": "..."}`, never a stack trace, SQL
fragment, internal file path, or secret. Status codes are used
consistently:

| Code | Meaning here |
|---|---|
| `400` | Malformed input that isn't a validation error (e.g. an invalid/expired token) |
| `401` | Not authenticated, or authenticated as an account that no longer qualifies (deactivated, token expired) |
| `403` | Authenticated, but missing the required permission, or blocked by a business rule tied to identity (e.g. unverified email) |
| `404` | Resource doesn't exist, or exists but isn't yours - identical response either way |
| `409` | Conflict with current state (e.g. submitting an already-submitted assessment) |
| `422` | Request body failed validation, or a business precondition is unmet (e.g. submitting with required fields still empty) |
| `429` | Rate limit exceeded (chat only, today) |
| `503` | A downstream dependency (the AI provider) is unavailable or unconfigured |

**Pagination**: list endpoints that can grow unbounded (`GET
/readiness-results`) accept `limit`/`offset` query parameters with a
capped maximum (`limit <= 100`, default `20`). Endpoints that return a
naturally small, fully-owned set (`GET /assessments`, `GET
/chat/sessions`) return everything at once.

**Idempotency**: `POST /assessments/{id}/score` and `GET
/readiness-results/{id}/recommendations` are safe to call repeatedly -
the first call creates the canonical row, every later call returns the
same one rather than duplicating it (enforced by a database unique
index, not just application logic - see `docs/scoring-methodology.md`
and `docs/recommendations.md`).

## Endpoints

### Auth (`/api/v1/auth`) - `docs/authentication.md`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | none | Create an account (starts unverified) |
| POST | `/login` | none | Exchange email/password for an access + refresh token |
| POST | `/verify-email` | none | Complete email verification with a token from the verification link |
| POST | `/resend-verification` | none | Re-send the verification link; always `204`, never reveals whether the email exists |
| POST | `/refresh` | refresh token in body | Rotate a refresh token for a new access + refresh token pair |
| POST | `/logout` | refresh token in body | Revoke a refresh token; always `204` |
| GET | `/me` | bearer | The current user's own account record, plus `roles` (presentational - which nav to show, not an authorization decision) |

### Users (`/api/v1/users`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/count` | none | Total registered user count (public, marketing use) |

### Assessments (`/api/v1/assessments`) - `docs/assessments.md`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `` | `assessment:create` | Create a draft (any subset of fields, or none) |
| GET | `` | `assessment:read:own` | List the caller's own assessments, newest first |
| GET | `/{id}` | `assessment:read:own` | Read one assessment |
| PATCH | `/{id}` | `assessment:update:own` | Update a `DRAFT` (`409` if already submitted) |
| POST | `/{id}/submit` | `assessment:update:own` | `DRAFT` → `SUBMITTED`; `422` if required fields are missing |
| POST | `/{id}/score` | `assessment:update:own` | Score a `SUBMITTED` assessment (idempotent) - `docs/scoring-methodology.md` |
| GET | `/{id}/result` | `assessment:read:own` | Read the persisted readiness result for this assessment |

### Readiness results (`/api/v1/readiness-results`) - `docs/results.md`, `docs/recommendations.md`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `` | `assessment:read:own` | The caller's full scoring history, newest first, paginated |
| GET | `/{id}/recommendations` | `assessment:read:own` | Deterministic recommendations for one result (generated on first call, idempotent) |

### Admin (`/api/v1/admin`) - `docs/realtor-onboarding.md`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/users` | `user:read:any` | List every account and its roles |
| POST | `/realtor-partners` | `partner:manage` | Create a vetted `real_estate_partners` record |
| GET | `/realtor-partners` | `partner:manage` | List partners + onboarding status |
| POST | `/realtor-partners/{id}/invite` | `partner:manage` | Issue + send a realtor invitation |

### Realtor invitations (`/api/v1/realtor-invitations`) - `docs/realtor-onboarding.md`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/lookup` | none | Validate a token without consuming it |
| POST | `/accept` | none | Redeem a token: onboard a new account or add REALTOR to an existing one |

### Realtor (`/api/v1/realtor`) - `docs/realtor-onboarding.md`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/connection-requests` | `connection:respond:own` | Requests addressed to the caller's linked partner record |
| POST | `/connection-requests/{id}/respond` | `connection:respond:own` | Accept/decline one |

### Chat (`/api/v1/chat`) - `docs/ai-architecture.md`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/sessions` | `chat:create` | Start a session, optionally linked to an owned assessment |
| GET | `/sessions` | `chat:read:own` | List the caller's own sessions |
| GET | `/sessions/{id}` | `chat:read:own` | One session with its full message history |
| POST | `/sessions/{id}/messages` | `chat:create` | Send a message; returns the stored user message and the assistant's reply together |

### Testimonials (`/api/v1/testimonials`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/featured` | none | Up to 5 highest-rated testimonials, for the public homepage |
| POST | `` | `testimonial:create` | Submit one testimonial (one per account) |

### Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check - no database access, just confirms the process is up |

## What's intentionally not exposed yet

No endpoint exists for: deleting an assessment, an admin "read any
assessment" surface (`assessment:read:any` is seeded but nothing uses it
yet - `user:read:any` now does, via `GET /admin/users`), document upload,
or a homebuyer actually creating a connection request (`connection:create`
is seeded and granted to `USER`, but nothing calls it - see
`docs/realtor-onboarding.md`). Adding any of these means adding both the
route and its permission/ownership checks together - never a route first
with authorization "to follow."
