# Authorization

How HomeReady AI decides **what a signed-in user is allowed to do**, as
distinct from authentication, which decides **who they are**.

```text
User
 ↓
Roles
 ↓
Permissions
 ↓
Resource Ownership
 ↓
Allow / Deny
```

Three separate concepts make up that chain, and none of them implies the
others:

```text
Role ≠ permission
Permission ≠ resource ownership
```

A role is just a label a user has (`ADMIN`). A permission is a specific
capability that role grants (`user:read:any`). Ownership is a fact about a
specific row (`assessments.user_id = current_user.id`). All three must line
up before a request is allowed.

---

## 1. Authentication vs. authorization

See `docs/authentication.md` for the authentication layer itself. In short:

| | Authentication | Authorization |
|---|---|---|
| Question | Who is the user? | What are they allowed to do? |
| Mechanism | JWT access token, verified in `get_current_user` | Roles/permissions resolved from the database, verified in `require_permission` and per-resource ownership checks |
| Failure | `401 Unauthorized` | `403 Forbidden` (permission) or `404 Not Found` (ownership) |

**Being authenticated does not imply being authorized.** A logged-in user
does not automatically get access to every resource or every action -
`get_current_user` only proves the request carries a valid token for an
active account; every route that touches sensitive data or an
administrative capability still has to check permissions and, for
user-owned resources, ownership.

---

## 2. RBAC model

```text
users
   ↓
user_roles
   ↓
roles
   ↓
role_permissions
   ↓
permissions
```

A user can hold multiple roles (`user_roles` is a many-to-many join table).
Each role grants a set of permissions (`role_permissions`, also
many-to-many). A user's **effective permissions** are the union of every
permission granted by every role they hold - see §8 (Multiple roles).

The database is the source of truth - there is no hard-coded Python
dictionary mapping roles to permissions anywhere in the application.
`app/services/authorization.py` resolves a user's roles and permissions
with a single parameterized query joining
`user_roles → roles → role_permissions → permissions`. An administrator
can change `role_permissions` in the database and the change takes
effect on the next request, with no code deploy and no cache to
invalidate (permissions are never cached at all - see §9).

---

## 3. Roles

```text
USER      Standard authenticated user
ADMIN     Full administrative access
SUPPORT   Customer support staff
REALTOR   Real estate professional partner
```

A future `SUPER_ADMIN` role is anticipated but doesn't exist yet - adding
it means deciding its exact permission set deliberately, not defaulting
it to "everything."

---

## 4. Permissions

Seeded entirely by migration (`alembic/versions/2a66097269d8_seed_permissions_and_role_permissions.py`,
with `testimonial:create` added later by
`alembic/versions/5e5ad50add74_create_testimonials_table_and_permission.py`).
This is the only source of truth for role → permission mappings; nothing
in application code overrides it.

```text
USER
    assessment:create
    assessment:read:own
    assessment:update:own
    chat:create
    chat:read:own
    file:create
    file:read:own
    file:delete:own
    connection:create
    testimonial:create

ADMIN
    assessment:read:any
    user:read:any
    audit:read
    scoring:update
    partner:manage

SUPPORT
    user:read:any

REALTOR
    testimonial:create
```

Design notes:

- **ADMIN is not "allow everything."** It holds exactly the five
  administrative permissions listed above. `ADMIN` does not implicitly get
  `assessment:create` or any other `USER` permission - an admin account
  that also needs to act as a regular user needs the `USER` role too.
- **SUPPORT is deliberately minimal.** It gets `user:read:any` (to look up
  an account for a support ticket - active/verified status, not financial
  data) and nothing else. It explicitly does **not** get
  `scoring:update` or `partner:manage`, and it does not get
  `assessment:read:any` or any `file:*`/`chat:*` permission, because those
  would expose a user's financial documents/conversations, which support
  does not need for account-status troubleshooting. If a future support
  workflow genuinely needs to view assessment data, that should be a new,
  explicit permission grant with its own audit trail - not a byproduct of
  broadening `user:read:any`.
- **REALTOR currently has one permission: `testimonial:create`.** It still
  cannot see connection requests, assessments, or any user's data. The
  intent is for REALTOR to eventually see connection requests that have
  been shared with it, but the schema has no link between
  `real_estate_partners` and a user account yet - there's no column or
  table saying "this REALTOR user corresponds to this
  `real_estate_partners` row." Granting a `connection:read:*`-style
  permission without that link would either do nothing or (if implemented
  carelessly) let any REALTOR see every connection request, which is
  exactly what per-resource ownership is meant to prevent. That link, and
  the permission it enables, belongs to whichever future change
  implements the real-estate connection workflow.
- **The REALTOR *role itself* is never self-service.** Registration
  (`auth_service.register_user`) hard-codes the `USER` role lookup - there
  is no "sign up as a realtor" option anywhere in the API, and no endpoint
  lets a user grant themselves or anyone else a role. A prospective
  real-estate partner is expected to submit their company information
  through a future application flow; a human admin reviews it and only
  then runs the `role_permissions`/`user_roles` grant directly. Until that
  review happens, the account has no REALTOR-only capability to reach -
  there isn't one yet beyond `testimonial:create`, which is intentionally
  also available to plain `USER` accounts and carries no elevated access.
  This is a product/security decision, not just an implementation detail:
  an unreviewed account must never be able to act as a real-estate
  professional inside the platform.

Permission names use a `resource:action[:scope]` convention
(`assessment:read:own` vs. `assessment:read:any`) so that "read your own"
and "read anyone's" are always distinct, explicit grants.

---

## 5. Resource ownership

RBAC alone is not sufficient. Holding `assessment:read:own` proves a user
can read *an* assessment they own - it says nothing about *which*
assessment a given request is for. Every user-owned resource is therefore
protected by an ownership check in addition to the permission check:

```sql
SELECT ... FROM assessments WHERE id = %s AND user_id = %s;
```

never

```sql
SELECT ... FROM assessments WHERE id = %s;
```

`app/services/ownership.py` implements this for every user-owned resource
in the schema:

| Resource | Ownership column used |
|---|---|
| `assessments` | `user_id` |
| `files` | `user_id` |
| `chat_sessions` | `user_id` |
| `chat_messages` | `session_id` (checked via `chat_sessions.user_id`) **and** its own denormalized `user_id` |
| `readiness_results` | `user_id` (denormalized from `assessments`) |
| `score_breakdowns` | `user_id` (denormalized from `readiness_results → assessments`) |
| `recommendations` | `user_id` (denormalized from `readiness_results → assessments`) |
| `connection_requests` | `user_id` |

`readiness_results`, `score_breakdowns`, `recommendations`, and
`chat_messages` are reachable from `users` via a foreign-key chain
(`score_breakdowns → readiness_results → assessments → users`), but the
schema also stores `user_id` directly on each of those tables. Filtering
on that denormalized column is the same security property as walking the
full chain - it just avoids the joins - so that's what `ownership.py`
does. Chat messages additionally resolve ownership through their parent
session (`chat_sessions.user_id`) before ever touching `chat_messages`,
so a client-supplied `session_id` alone is never trusted.

Every `get_owned_*` function returns `None` when the resource doesn't
exist **or** belongs to someone else - it never distinguishes the two (see
§6). The S3 object key, similarly, is never treated as authorization by
itself; once file upload/download routes exist, a presigned URL will only
ever be generated after this same database-ownership check - no such
routes exist yet.

Administrative "read any" access (`assessment:read:any`, etc.) is a
**separate function with no ownership filter**
(`get_assessment_by_id`), and it is only safe to call after
`require_permission("assessment:read:any")` has already confirmed the
caller holds that permission. The two are never merged into one
"maybe-filtered" query.

---

## 6. IDOR / BOLA protection

The classic attack this guards against:

```text
User A normally owns assessment A001.
User A edits the URL/ID to request assessment A002, which belongs to User B.
```

Every ownership function above returns `None` in that case, and callers
must turn `None` into a generic **404 Not Found** - not a 403, and not a
message that reveals whether the resource exists. Returning "403: you
don't own assessment A002" would confirm that `A002` exists and belongs to
someone else, which is itself an information leak. `404` in both the
"never existed" and "exists but isn't yours" cases keeps the two attacks
indistinguishable from the outside.

This is a different rule from *permission* denials (§7): a user who lacks
`assessment:read:own` entirely gets a `403` immediately, because knowing
"you don't have this permission at all" doesn't leak anything about any
specific resource. It's the ownership check on a specific ID that stays
ambiguous.

Every resource's test suite includes a two-user IDOR sweep: create two
accounts, each with their own copy of the resource, and confirm User A
gets `404` for every one of User B's resource IDs -
`test_authorization.py`, `test_assessments.py`, `test_readiness_results.py`,
`test_recommendations.py`, and `test_chat.py` each carry one of these for
their own resource types.

---

## 7. Admin authorization

Admin access is never implemented as a role check:

```python
# never do this
if "ADMIN" in user.roles:
    allow_everything()
```

It's always a permission check, exactly like any other user:

```python
require_permission("user:read:any")
```

`ADMIN` happens to be the only role currently granted that permission, but
the check itself doesn't know or care what role granted it - which is what
makes it possible for `role_permissions` to change in the database without
touching route code, and what stops "the role is literally called ADMIN"
from becoming an implicit bypass. `test_authorization.py` covers both
directions: an `ADMIN` account is allowed through `require_permission` for
a permission it holds, and explicitly **denied** for a permission it does
not hold (`assessment:create`, which only `USER` has).

---

## 8. Multiple-role behavior

A user can hold more than one role at once (`user_roles` is many-to-many).
Effective permissions are the **union** of every permission granted by
every role the user holds:

```text
USER permissions ∪ REALTOR permissions ∪ ... = effective permissions
```

`app/services/authorization.get_user_roles_and_permissions` computes this
in one query - it does not special-case "first role wins" or otherwise
treat multiple roles as ambiguous. `test_authorization.py` covers a
`USER + SUPPORT` account and confirms the effective permission set
contains permissions from both roles, and a `USER + REALTOR` account
(which currently equals `USER` alone, since REALTOR grants nothing yet -
see §4).

---

## 9. Permission caching

None, deliberately. `get_authorization_context` resolves a user's
roles/permissions from the database on every request. This means an
administrator revoking a permission in `role_permissions` takes effect on
the very next request for every affected user - there is no cache to
invalidate or TTL to wait out. Adding caching later for performance would
need an invalidation story (e.g. bust on `role_permissions`/`user_roles`
writes) before it ships; until then, correctness and simplicity win over
the extra round trip.

---

## 10. HTTP authorization errors

| Status | Meaning | Example |
|---|---|---|
| `401 Unauthorized` | No valid, active-user session at all | Missing/expired/invalid token (`get_current_user`) |
| `403 Forbidden` | Authenticated, but lacks the required permission outright | `require_permission(...)` denial |
| `404 Not Found` | Authenticated and holds the permission, but the specific resource doesn't exist or isn't owned by this user | Any `get_owned_*` ownership-check miss (§6) |

The `403` detail string is always the same generic message
(`"You do not have permission to perform this action"`) regardless of
which permission or resource was involved - it never says something like
*"You are not allowed to access user U002's assessment A002"*, since that
would leak information about another user's data.

---

## 11. Audit logging

Every permission denial from `require_permission` is recorded in
`audit_logs` as `UNAUTHORIZED_ACCESS_ATTEMPT`, with the permission that
was checked in `metadata` - never the resource's data, never another
user's information. This reuses `app/services/audit.log_event` and
follows the same pattern used for failed logins and refresh-token reuse:
the audit entry is committed explicitly before the `HTTPException` is
raised, since the `get_db` dependency would otherwise roll back the whole
request - including the audit row - on that same exception.

Nothing sensitive goes into audit metadata: no passwords, password hashes,
JWTs, refresh tokens, AWS credentials, or financial data - only the
permission key that was checked.

---

## 12. Reusable authorization dependencies

```text
Request
   ↓
get_current_user()            → 401 if no valid, active-user session
   ↓
get_authorization_context()   → resolves roles + effective permissions from the DB
   ↓
require_permission("x:y:z")   → 403 if the permission isn't in the effective set
   ↓
resource ownership check      → 404 if the specific resource isn't owned by this user
   ↓
route handler
```

- `app/schemas/authorization.py` - `AuthorizationContext` (`user_id`,
  `is_active`, `roles`, `permissions`). Deliberately excludes password
  hashes, tokens, and financial data - it's only ever used to make an
  allow/deny decision.
- `app/services/authorization.py` - `get_user_roles_and_permissions`, the
  single parameterized query described in §2.
- `app/services/ownership.py` - the `get_owned_*` functions described in
  §5, one per user-owned resource type.
- `app/api/deps.py` - `get_authorization_context` (wraps the service call
  as a FastAPI dependency) and `require_permission(permission)` (a
  dependency *factory*: `Depends(require_permission("assessment:create"))`),
  so a route declares what it needs without duplicating any lookup logic.

Every business route built since - assessments, readiness results,
recommendations, and chat - composes `require_permission(...)` with the
matching `ownership.get_owned_*` function exactly as described above; see
`docs/api-design.md` for the full endpoint list and which permission each
one requires.

---

## 13. Testing

`backend/tests/test_authorization.py` runs against a real PostgreSQL
database (skipped if `DATABASE_URL` isn't set) and covers:

- **Permission tests** - each role's exact effective permission set;
  `require_permission` allowing/denying correctly; an unknown permission
  string always denied, even for `ADMIN`; the generic (non-leaking) denial
  message; the audit log entry a denial creates.
- **Admin tests** - `USER` denied an admin-only permission; `ADMIN`
  allowed a permission it holds; `ADMIN` denied a permission it does not
  hold (proving admin is not "allow everything").
- **Multiple-role tests** - `USER + SUPPORT` produces the union of both
  roles' permissions; `USER + REALTOR` (currently a no-op beyond `USER`
  alone, see §4).
- **Ownership tests** - two users, each with one of every ownership-checked
  resource type, verifying the owner is allowed and the other user is
  denied, for every resource in §5.
- **IDOR test** - a single test that swaps every one of User B's resource
  IDs into User A's context and confirms every lookup returns `None`.

Every business feature's own test suite (`test_assessments.py`,
`test_readiness_results.py`, `test_recommendations.py`, `test_chat.py`)
additionally runs the same two-user IDOR pattern at the HTTP layer,
through the actual routes rather than the service functions directly.

---

## Summary

```text
Authentication  → who the user is (docs/authentication.md)
RBAC            → which roles the user holds, and what permissions those roles grant
Ownership       → whether this specific resource belongs to this specific user
```

All three must agree before a request is allowed. None of them is a
substitute for either of the others, and the frontend is never trusted to
enforce any of them - every check above runs on the backend, on every
request, regardless of what the UI shows or hides.
