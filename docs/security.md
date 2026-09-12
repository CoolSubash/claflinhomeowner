# Security

A summary of the security posture across the application, with pointers
to where each control is actually implemented and tested. For attack
scenarios and what's still unmitigated, see `docs/threat-model.md`.

## Authentication

- Passwords are hashed with **Argon2id** (`argon2-cffi`) and never
  logged, stored in plaintext, or returned in any API response.
- Access tokens are short-lived JWTs (15 minutes by default); refresh
  tokens are opaque, cryptographically random values, hashed with
  SHA-256 before storage, single-use, and rotated on every refresh. A
  reused (already-rotated) refresh token revokes the entire session
  family, not just itself.
- New accounts must verify their email before they can log in.
  Verification tokens follow the same design as refresh tokens: random,
  hashed at rest, single-use, expiring.
- Login and refresh failures return one generic, timing-equalized error
  regardless of the actual cause (unknown email, wrong password, inactive
  account) - the one deliberate exception is the unverified-email
  rejection, which only fires after the password has already been proven
  correct.

Full detail: `docs/authentication.md`.

## Authorization

- Permissions are granular strings (`assessment:read:own`,
  `chat:create`, ...) resolved fresh from the database on every request -
  never cached, never embedded in the JWT.
- Every resource endpoint enforces **authentication → permission →
  ownership → query**, in that order. Ownership is enforced in SQL
  (`WHERE id = %s AND user_id = %s`), never "fetch then compare in
  Python."
- A request for a resource that doesn't exist and a request for a
  resource that exists but belongs to someone else return the identical
  `404` - deliberately, so the response never confirms whether a given ID
  exists for another account.

Full detail: `docs/authorization.md`.

## Application-layer protections

- **SQL injection**: every query is parameterized (`psycopg`'s `%s`
  placeholders); nothing is built by string concatenation or f-strings,
  anywhere in the codebase.
- **No ORM**: the application talks to PostgreSQL through raw SQL by
  design (`docs/database.md`) - there's no query-building layer that
  could silently reintroduce unparameterized input.
- **Input validation**: every request body is validated by a Pydantic
  schema before it reaches a service function - out-of-range values
  (e.g. a credit score outside 300-850) are rejected as a clean `422`
  rather than surfacing as a database constraint error.
- **Error responses** never include stack traces, SQL text, internal file
  paths, or secrets - FastAPI's structured `{"detail": "..."}` shape is
  the only error format returned to a client.

## AI security

- The AI provider never has direct database access. The backend builds a
  minimal, explicitly-scoped context object (specific assessment fields,
  score breakdown, recommendations) and hands it to `AIService` - nothing
  the caller hasn't already been authorized to see.
- A chat message's text is only ever passed as the model's final "user"
  turn, never concatenated into the system prompt - the system prompt
  itself instructs the model that message content is untrusted input, not
  a new instruction, no matter what it claims to be.
- The AI can explain a score or recommendation; it cannot write to
  `readiness_results`, `score_breakdowns`, or `recommendations` - nothing
  in the chat code path has write access to those tables.
- Provider output is validated before use (response shape, non-empty,
  bounded length) rather than passed straight through.

Full detail: `docs/ai-architecture.md`.

## Database security

- Primary keys are UUIDs (`gen_random_uuid()`), not sequential integers -
  removes free enumeration as an attack surface (it doesn't replace
  authorization, but it removes a cheap way to guess valid IDs).
- Every user-owned table carries `user_id` directly, so an ownership
  filter never depends on a join being written correctly.
- The application is expected to connect with a least-privileged
  database role in production - see `docs/deployment.md`'s
  "before deploying to production" checklist; this is not yet enforced
  anywhere outside that checklist.

Full detail: `docs/database.md`.

## Audit logging

Every sensitive operation (login, logout, registration, email
verification, assessment CRUD, scoring, chat, unauthorized-access
attempts) writes an append-only row to `audit_logs`, including denied
requests (`UNAUTHORIZED_ACCESS_ATTEMPT`). Audit entries never contain
passwords, JWTs, refresh tokens, API keys, or financial field values -
only IDs, actions, and non-sensitive metadata.

## Secrets

- `.env` is gitignored; `.env.example` carries variable names and
  placeholders only, never a real value.
- `JWT_SECRET`, `AI_API_KEY` (when using the direct Anthropic provider),
  and the database connection string are read from environment variables
  at runtime, never hard-coded.
- AWS credentials for the Bedrock AI provider are never an application
  setting at all - they're resolved by boto3's own credential chain
  (environment variables or an IAM role), so there's no AWS secret in
  this app's config, logs, or code to leak in the first place (see
  `docs/ai-architecture.md`).
- No AWS credentials are ever sent to the browser.

## What's not implemented yet

These are named requirements the project hasn't built out yet - not
gaps introduced by an oversight, but features later than what currently
exists:

- **Document upload / S3 / KMS**: no upload endpoint, no presigned URL
  generation, no file processing exists yet. The planned design (private
  bucket, backend-generated object keys, short-lived presigned URLs,
  ownership re-checked before every URL is issued) is already agreed for
  when it's built.
- **Rate limiting outside chat**: only the AI chat endpoint has a rate
  limiter today (`docs/ai-architecture.md`), and it's in-process, not
  distributed - fine for a single backend instance, not yet sufficient
  for a multi-instance deployment.
- **`SUPER_ADMIN`**: doesn't exist as a role at all yet.
