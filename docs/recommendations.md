# Recommendations

A deterministic, rule-based engine over a persisted `score_breakdowns` row
set. No AI, no recalculation of any score. Pure logic lives in
`app/services/recommendations.py::build_recommendations`, kept free of SQL
the same way `app/services/scoring.py` keeps score calculation free of it.

## Rule

For each category in a result's breakdown:

```
category_score >= 75  -> no recommendation (already at "READY" level)
category_score <  75  -> one recommendation, priority by score:
    score < 40          -> HIGH
    40 <= score < 60     -> MEDIUM
    60 <= score < 75     -> LOW
```

These boundaries are not new magic numbers - they're the same 40/60/75
boundaries `scoring.READINESS_BANDS` already uses for the overall-score
bands (`NOT_READY`/`NEEDS_IMPROVEMENT`/`ALMOST_READY`/`READY`), applied
per-category instead of to the overall score. Recommendations are sorted
weakest-category-first.

## Copy

Each category has one fixed title/description
(`_CATEGORY_COPY` in `recommendations.py`), written in a "Consider..."
register - never "You must..." or a claim of guaranteed outcome. `source`
is always `"system"`; the `recommendations` table's `source` column also
allows `"ai"` for a possible future AI-authored recommendation, but
nothing today ever writes that value.

## Endpoint

```
GET /api/v1/readiness-results/{result_id}/recommendations
```

Requires authentication and `assessment:read:own` (reused rather than
adding a new permission - a recommendation set is just a decoration on a
readiness result, which is itself only reachable through an owned
assessment). Ownership is enforced via `get_owned_readiness_result`
before recommendations are generated or read; a result that doesn't
exist or belongs to another user returns a 404.

## Idempotency

"One recommendation set per readiness_result" is enforced two ways:

1. **Application logic**: `get_or_create_recommendations` first selects
   any existing rows for `(readiness_result_id, user_id)`; only if none
   exist does it generate and insert.
2. **Database constraint**: a unique index,
   `uq_recommendations_readiness_result_category` on
   `(readiness_result_id, category)` (migration `484310a89338`), is the
   backstop for two concurrent first requests racing each other - the
   losing insert raises `UniqueViolation` inside a savepoint
   (`conn.transaction()`), which is caught and turned into a re-read of
   what the winner inserted, exactly the pattern
   `readiness_results.score_and_persist` uses for the analogous
   assessment/scoring-version race.

Repeated `GET`s never create duplicate rows -
`test_recommendations_no_duplicates_on_repeated_get` asserts this.

## Historical behavior

Recommendations belong to a `readiness_result`, not an assessment or a
user in general. Scoring a second assessment produces a second
`readiness_results` row and, lazily, a second independent recommendation
set; the first result's recommendations are never touched
(`test_two_assessments_keep_separate_recommendation_sets`).

## Security

Same authenticate → permission → ownership → query chain as every other
resource endpoint. `test_recommendations_non_owner_denied` and
`test_recommendations_unauthenticated_rejected` cover the IDOR/BOLA and
auth cases.

## Audit logging

`RECOMMENDATIONS_VIEWED` is logged on every successful `GET`, scoped to
the `readiness_result` id. No financial values are logged.

## Weak-area identification

See `docs/results.md` - `identify_weak_areas` is a separate, smaller
function (top-2-lowest by score) used for the "Areas to Focus On" UI list,
distinct from `build_recommendations`'s per-category threshold rule.

## Not implemented here

No AI-authored recommendations, no ability for a user or the AI to edit or
override a stored recommendation (the AI assistant may *explain* a
recommendation but must not silently replace it - see
`docs/ai-architecture.md`).
