# Assessments

An assessment is the set of financial/home-buying figures a user enters so
HomeReady AI can calculate a readiness score for them. This
document covers the assessment lifecycle itself - creating, editing,
submitting, and reading assessments. Scoring itself (the engine, the API,
the persisted result) is documented in `docs/scoring-v1.md`.

---

## Lifecycle

```text
DRAFT ──submit──▶ SUBMITTED
```

Only `DRAFT` and `SUBMITTED` are ever used. `PROCESSING`, `COMPLETED`, and
`FAILED` remain in the `assessments.status` CHECK constraint but are not
reachable through anything currently implemented: scoring a `SUBMITTED`
assessment (`docs/scoring-v1.md`) never changes the assessment's own
`status` - it leaves the assessment at `SUBMITTED` and records the
outcome as a separate `readiness_results` row instead (with its own
`status`, e.g. `READY`/`NOT_READY`). This keeps "what the user told us"
and "how ready our methodology says they are" as two different pieces of
state that can't be confused with each other - an assessment can be
scored more than once across future scoring versions without needing to
represent "in between" states on the assessment itself.

- **`DRAFT`** - the only editable state. A user can create a draft with any
  subset of fields filled in and come back later to fill in the rest.
- **`SUBMITTED`** - set once, by `POST /assessments/{id}/submit`, and never
  reverted. A submitted assessment is immutable: `PATCH` on it returns
  `409 Conflict`. This matters because a readiness result is computed from
  a specific assessment's values - if those values could change after
  scoring, a stored result would silently stop matching what it claims to
  describe.

Submitting requires every scoring-relevant field to be present: `income`,
`monthly_debt`, `credit_score`, `savings`, `down_payment`,
`target_home_price`, `employment_years`. `location` is intentionally not
required - the v1 scoring methodology doesn't use it (see
`docs/scoring-v1.md`). Submitting with any required field still `null`
returns `422` naming exactly which fields are missing (safe to reveal:
it's always the caller's own assessment).

---

## API

All endpoints require authentication and enforce ownership - see
`docs/authorization.md` for the general RBAC/ownership model this reuses
directly (`assessment:create`, `assessment:read:own`,
`assessment:update:own`).

```http
POST   /api/v1/assessments                 create a draft (fields optional)
GET    /api/v1/assessments                 list the caller's own assessments, newest first
GET    /api/v1/assessments/{id}            read one (owner only)
PATCH  /api/v1/assessments/{id}            partially update a DRAFT (owner only)
POST   /api/v1/assessments/{id}/submit     DRAFT -> SUBMITTED (owner only)
POST   /api/v1/assessments/{id}/score      score a SUBMITTED assessment (owner only) - see docs/scoring-v1.md
GET    /api/v1/assessments/{id}/result     read the canonical v1 result for an assessment (owner only)
GET    /api/v1/readiness-results           the caller's full scoring history, newest first
```

A request for another user's assessment ID - `GET`, `PATCH`, `submit`,
`score`, or `result` - returns `404 Not Found`, identical to a
nonexistent ID, per the IDOR strategy in `docs/authorization.md` §6.

### `PATCH` semantics

Each field is applied with `COALESCE(new_value, existing_value)`: send
only the fields you want to change, omitted fields keep their current
value. There is no way to explicitly clear a field back to `null` once
set - a deliberate simplification, since there's no product need to erase
a value while filling out a draft you're working toward submitting.

---

## Validation

Pydantic enforces, before anything reaches the database:

| Field | Rule |
|---|---|
| `income`, `monthly_debt`, `savings`, `down_payment` | `>= 0`, `<= 9,999,999,999.99` |
| `target_home_price` | `> 0`, `<= 9,999,999,999.99` |
| `credit_score` | `300`-`850` |
| `employment_years` | `>= 0`, `<= 999.9` |
| `location` | optional, `<= 255` characters |

The upper bounds match the `assessments` table's actual `NUMERIC(12,2)` /
`NUMERIC(4,1)` column precision exactly, so an out-of-range value is
rejected as a clean `422` here instead of surfacing as a raw database
error later.

---

## Ownership

`user_id` always comes from the authenticated caller
(`AuthorizationContext.user_id`), never from the request body - a client
cannot create or claim an assessment on another account's behalf. Reads,
updates, and submissions all filter by `id = %s AND user_id = %s` in SQL
(via `app/services/ownership.get_owned_assessment`, shared with every
other feature that checks ownership - `docs/authorization.md`), not by
fetching and checking in Python.

---

## Audit logging

Recorded via the `audit_logs` table (`docs/security.md`):

```text
ASSESSMENT_CREATED
ASSESSMENT_VIEWED         (on GET /assessments/{id})
ASSESSMENT_SUBMITTED
ASSESSMENT_SCORED         (on POST /assessments/{id}/score, only when a new result is created)
READINESS_RESULT_VIEWED   (on GET /assessments/{id}/result)
```

Metadata is limited to IDs (`assessment_id`, `readiness_result_id`,
`scoring_version`) - never income, debt, credit score, or any other
financial value. `GET /readiness-results` (history) is not individually
audit-logged, same reasoning as the assessment list below.

`PATCH` is not individually audit-logged. A draft may be saved many times
while a user fills out a form; logging every autosave would be noisy
without adding security value. The meaningful, audited transitions are
creation, being viewed, and submission.

---

## Frontend

```text
/assessments               list the caller's own assessments (status, target price, link in)
/assessments/new           creates a draft (POST with an empty body) and redirects to it
/assessments/{id}          DRAFT: the editable form (AssessmentForm) + "Submit & get my score"
                            non-DRAFT: a read-only summary + a link to /results/{id}
```

`/assessments/{id}` drives the whole submit flow client-side: `POST
.../submit` then, on success, `POST .../score` in sequence, then redirects
straight to `/results/{id}`. The frontend never computes anything - it
only sequences the two existing write endpoints. If scoring fails after a
successful submit (network blip, etc.), the assessment is left at
`SUBMITTED` with no result; the page detects this (a 404 from `GET
.../result`) and offers a "Score this assessment" retry instead of
silently failing.

Money/`employment_years` fields round-trip as decimal-typed *strings* in
JSON (`"72000.00"`, matching the `NUMERIC` column types) - the frontend
types (`lib/types.ts::Assessment`) reflect that exactly rather than
widening them to `number`, so nothing silently loses precision converting
through JS floats.

`PATCH`'s "can't clear a field back to `null`" limitation (see above)
applies to the form as-is: leaving a field blank and saving leaves the
previous value in place rather than erasing it.

## What's not included yet

* Deleting an assessment
* Listing another user's assessments (no `assessment:read:any` route or UI exists yet)
* Document upload attached to an assessment (a later phase)
* A UI to explicitly clear a single field back to empty (see `PATCH` semantics above)
