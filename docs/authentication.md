# Authentication

Registration, email verification, login, access/refresh tokens,
refresh-token rotation, logout, and the current-user endpoint.

This document covers *who the caller is*; it does not cover what they're
allowed to do beyond owning their own account - that's RBAC and
per-resource ownership, covered separately in `docs/authorization.md`.

## Architecture

```text
Frontend
   |
   v
FastAPI route (app/api/routes/auth.py)
   |
   v
Pydantic validation (app/schemas/auth.py)
   |
   v
Auth service (app/services/auth_service.py)
   |
   v
psycopg 3 raw SQL  ---->  PostgreSQL (users, refresh_tokens, user_roles, audit_logs)
   ^
   |
app/security/passwords.py   (Argon2id)
app/security/tokens.py      (JWT access tokens, opaque refresh tokens)
```

Every write for a single request runs on one pooled connection, borrowed via
the `get_db` FastAPI dependency (`app/api/deps.py`). That dependency commits
the connection when the request handler returns normally and rolls it back
if an exception escapes — so a single request's writes (e.g. registering a
user, assigning their role, and writing the audit log) are atomic without
any explicit `BEGIN`/`COMMIT` in route code. The one deliberate exception is
documented in "Audit logging on failure paths" below.

## Endpoints

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-verification
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Registration flow

```text
1. Pydantic validates email/password/name
2. Email normalized (trimmed, lowercased)
3. Check email not already registered (case-insensitively)
4. Hash password with Argon2id
5. INSERT INTO users ... RETURNING id, email, first_name, last_name,
       is_active, email_verified, created_at
6. Look up the USER role and INSERT INTO user_roles
7. INSERT INTO audit_logs (action = USER_REGISTERED)
8. Return the new user (never the password or password_hash)
```

New users start with `is_active = true`, `email_verified = false`, and
cannot log in until verified (see "Email verification" below).

Every new user is assigned the `USER` role from the existing `roles` table
(seeded by the `seed initial roles` migration — see `docs/database.md`).
Registration only ever assigns this one fixed role; what that role can
actually do is entirely `docs/authorization.md`'s concern, not this file's.

A duplicate email returns `409 Conflict` with `{"detail": "Email already
registered"}` — unlike login, registration intentionally does confirm the
email is taken, since the caller just typed it in themselves.

### Login flow

```text
1. Normalize email
2. Look up user by (LOWER) email
3. If not found: run a dummy Argon2 verify anyway, then reject
4. If found: verify password with Argon2id
5. Reject if the password is wrong OR the account is inactive
   (same generic error either way)
6. Reject (403, distinct error) if the account exists, is active, and the
   password is correct, but email_verified is still false
7. Create a short-lived JWT access token
8. Generate a random refresh token, hash it, store the hash
9. UPDATE users.last_login_at
10. INSERT INTO audit_logs (action = USER_LOGIN, or USER_LOGIN_FAILED)
11. Return { access_token, refresh_token, token_type, expires_in }
```

**User-enumeration resistance:** every rejection path that can occur
*before* the password has been proven correct — unknown email, wrong
password, inactive account — returns the identical
`401 {"detail": "Invalid email or password"}`. The "unknown email" path
still runs a real Argon2id verification against a fixed dummy hash before
returning, so the response time doesn't leak which case occurred either.

The one deliberate exception is the unverified-email rejection
(`403 {"detail": "Please verify your email before signing in"}`): unlike
the cases above, this only fires *after* the caller has already proven
they know the correct password for that email, so a more specific message
here doesn't hand an attacker anything they couldn't already infer. This
ordering (`is_active` checked, and its generic error returned, before
`email_verified`) is intentional so a deactivated-and-unverified account
never reveals its verification state either.

### Access tokens (JWT)

Claims are deliberately minimal:

```text
sub  - user UUID
iat  - issued-at (unix seconds)
exp  - expiration (unix seconds)
jti  - unique token id (unused for revocation in this phase; present so a
       denylist can be added later without a token-format change)
```

No financial data, role, or permission information is ever placed in the
token — every request re-reads current account status from PostgreSQL (see
"Why access tokens don't carry authorization state" below).

Signed with `HS256` using `JWT_SECRET`. Lifetime is controlled by
`ACCESS_TOKEN_EXPIRE_MINUTES` (default 15).

### Refresh tokens

The refresh token itself is a 384-bit random string from Python's `secrets`
module (`app/security/tokens.generate_refresh_token`) — never a JWT, never
derived from anything guessable. Only its SHA-256 hash is stored, in
`refresh_tokens.token_hash`. SHA-256 rather than Argon2id here is
deliberate: the input is already high-entropy random data (unlike a human
password), so a slow KDF would only add a cheap denial-of-service vector to
every refresh-token lookup without adding real security.

```text
refresh_tokens
---------------
user_id, token_hash (unique), issued_at, expires_at,
revoked_at (null while active), replaced_by_id (rotation chain),
user_agent, ip_address
```

Lifetime is controlled by `REFRESH_TOKEN_EXPIRE_DAYS` (default 30).

### Refresh-token rotation and reuse detection

```text
POST /auth/refresh { refresh_token }
   |
   v
hash the token, look it up
   |
   +-- not found                       -> 401
   +-- found but already revoked_at    -> reuse detected: revoke every
   |                                       active refresh token for that
   |                                       user, log REFRESH_TOKEN_REUSE_
   |                                       DETECTED, then 401
   +-- found but expires_at in past    -> 401
   +-- user no longer is_active        -> 401
   |
   v
revoke this token (revoked_at = now(), replaced_by_id = <new token id>)
issue a new refresh token + new access token
INSERT audit log (action = TOKEN_REFRESHED)
```

Every refresh token is single-use. Presenting a token a second time doesn't
just fail — since it can only mean the token leaked or a request was
duplicated, the whole session family for that user is revoked, not just the
one token. This is deliberately blunt rather than tracking token families:
simple, and correct for a single-session-at-a-time mental model.

### Email verification

```text
email_verification_tokens
--------------------------
user_id, token_hash (unique), expires_at, used_at (null while unused),
created_at
```

Same design as refresh tokens: the plaintext token is a 384-bit random
value from `app/security/tokens.generate_secure_token` (the same
generator `generate_refresh_token` now delegates to), only its SHA-256
hash (`hash_token`) is ever stored, and it's single-use (`used_at`).
Lifetime is `VERIFICATION_TOKEN_TTL_HOURS` (24,
`app/services/email_verification.py`).

```text
POST /auth/register
   |
   v
create the user (email_verified = false, as before)
   |
   v
issue a verification token, INSERT email_verification_tokens
   |
   v
EmailService.send_verification_email(to, first_name, verification_url)
   |
   v
INSERT audit_logs (action = EMAIL_VERIFICATION_SENT)
```

```text
POST /auth/verify-email { token }
   |
   v
hash the token, look it up
   |
   +-- not found, already used, or expired -> 400 (identical error for
   |                                            all three - never confirms
   |                                            whether a token existed)
   v
mark it used, UPDATE users SET email_verified = true
INSERT audit_logs (action = EMAIL_VERIFIED)
return the user
```

```text
POST /auth/resend-verification { email }
```

Always returns `204 No Content`, whether the email is unregistered,
already verified, or genuinely gets a new token - the same
user-enumeration-resistance pattern `/auth/logout` already uses for an
unrecognized refresh token.

**EmailService abstraction** (`app/services/email/`) - the same shape as
`AIService` (`docs/ai-architecture.md`): `app/services/email_verification.py`
depends only on the `EmailService` interface, never a concrete provider.
The only implementation today is `ConsoleEmailService`
(`app/services/email/console_provider.py`), which logs the finished
verification URL rather than sending real mail - no SMTP/SES credentials
are configured anywhere in this project yet. In local development, register a user and
read the link from the backend's own console output. Adding a real
provider later (e.g. AWS SES) means adding one class in
`app/services/email/` and pointing `app/api/deps.py::get_email_service`
at it - nothing else in the app changes. The verification link's base URL
comes from `FRONTEND_BASE_URL` (default `http://localhost:3000`).

### Logout

```text
POST /auth/logout { refresh_token }
```

Revokes the given refresh token (`revoked_at = now()`) if it matches an
active one, and logs `USER_LOGOUT` — but **always returns `204 No Content`**
whether or not the token matched anything. This is deliberate: an error
response that only appears for a *valid* token would let a caller probe
whether an arbitrary token string was ever issued.

Logging out does not and cannot invalidate an already-issued access token —
JWTs are stateless and self-verifying, so a still-unexpired access token
keeps working for up to `ACCESS_TOKEN_EXPIRE_MINUTES` after logout. This is
why access tokens are kept short-lived. Deactivating the account, not
logging out, is the correct action to end a user's whole current session
immediately (both `GET /auth/me` and the refresh flow re-check `is_active`
against the database on every call).

### `GET /auth/me`

Requires `Authorization: Bearer <access_token>`. The dependency
(`app/api/deps.get_current_user`) validates the JWT signature and
expiration, extracts `sub`, then **re-reads the user row from PostgreSQL**
and checks `is_active` before returning it. Returns the same safe user
shape as registration — never `password_hash`.

### Why access tokens don't carry authorization state

An access token proves identity at the moment it was issued, nothing more.
If an admin deactivates a user mid-session, their existing (still
unexpired) access token must stop working immediately — which is only
possible by re-checking the database on every request rather than trusting
`is_active` baked into the token. The same reasoning is why permissions/role
data isn't in the JWT either (`docs/authorization.md`): a role change should
take effect on the next request, not after the current access token expires.

## Audit logging on failure paths

`app/api/deps.get_db` commits the connection when a request finishes
normally and rolls it back if any exception escapes the route. A rejected
login or a detected refresh-token reuse *is* an exception path (the service
layer raises, and the route converts it to an `HTTPException`) — so without
special handling, the very audit log entry recording the failure would be
rolled back along with everything else on that connection.

`authenticate_user` and the reuse-detection branch of `refresh_access_token`
therefore call `conn.commit()` explicitly right after writing their audit
log entry (and, for reuse detection, after revoking the token family) and
before raising. This was caught and fixed during testing: an earlier
implementation silently dropped every `USER_LOGIN_FAILED` audit entry
and — more seriously — the reuse-detection revocation itself never actually
took effect, because it was being rolled back along with the rejection.

## Environment variables

```text
JWT_SECRET                     # HS256 signing key - long, random, never committed
ACCESS_TOKEN_EXPIRE_MINUTES    # default 15
REFRESH_TOKEN_EXPIRE_DAYS      # default 30
FRONTEND_BASE_URL              # default http://localhost:3000 - only used to build the
                                # verification email's link, never for CORS or any
                                # security decision
```

## Security summary

* **Passwords:** Argon2id only (`argon2-cffi`), never logged, never
  returned in any response.
* **SQL:** every query is parameterized (`%s` placeholders via psycopg 3);
  no string interpolation or concatenation is used to build SQL anywhere in
  the auth code.
* **JWTs:** signed (`HS256`), verified on every request, expiration
  enforced, required-claims enforced (`sub`, `exp`, `iat`, `jti`), no
  sensitive data in claims.
* **Refresh tokens:** cryptographically random, hashed before storage,
  single-use (rotation), revocable, reuse triggers full-session revocation.
* **User enumeration:** login and refresh both return one generic error
  for every pre-password-check failure; login additionally
  timing-equalizes the "unknown email" path. `resend-verification` always
  returns `204` regardless of whether the email is registered. The one
  intentional exception is login's unverified-email error, which only
  fires after the password has already been proven correct (see "Login
  flow" above).
* **Secrets:** `JWT_SECRET` lives only in `.env` (gitignored);
  `.env.example` carries a placeholder, never a real value.
* **Error handling:** no SQL errors, stack traces, or internal details are
  ever returned to the client (FastAPI's default validation/HTTP error
  responses are the only structured error shapes returned).
