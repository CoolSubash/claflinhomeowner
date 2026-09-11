# Results & History

Consumes the persisted output of the deterministic scoring engine
(`docs/scoring-methodology.md`). Nothing in this layer recalculates a
score - it reads `readiness_results` and `score_breakdowns` rows exactly
as the scoring engine wrote them.

## Endpoints

```
GET /api/v1/assessments/{assessment_id}/result
GET /api/v1/readiness-results
```

Both require authentication and `assessment:read:own`. `user_id` is always
taken from the authenticated caller's token, never from a request
parameter (see `docs/authorization.md`).

### `GET /assessments/{assessment_id}/result`

Returns the caller's persisted result and breakdown for one assessment.
Ownership is checked via `get_owned_assessment` before the result is
looked up, so a non-owner gets the same 404 whether the assessment doesn't
exist or belongs to someone else. If the assessment exists but hasn't been
scored yet, a more specific 404 ("No readiness result exists for this
assessment yet") is safe to return, since ownership was already confirmed.

### `GET /readiness-results`

Returns the caller's own results, newest first, paginated with
`limit`/`offset` (default 20, max 100). Backed by
`app/services/readiness_results.list_results_for_user`, which filters by
`user_id` in SQL rather than fetching everything and filtering in Python.

## Response shape

```json
{
  "id": "...",
  "assessment_id": "...",
  "scoring_version": "v1",
  "overall_score": 74,
  "readiness_level": "ALMOST_READY",
  "created_at": "...",
  "components": [
    { "category": "financial_stability", "score": 78, "weight": 0.25, "raw_value": 72000.00, "explanation": "..." }
  ]
}
```

## Weak-area identification

`app/services/recommendations.identify_weak_areas` returns the two
lowest-scoring categories from a result's breakdown, weakest first. Ties
are broken by a fixed category order (the same order `scoring.WEIGHTS` is
declared in) so the result is deterministic regardless of how the
breakdown rows were fetched. No AI is involved; see
`docs/recommendations.md` for the full rule engine this feeds.

## Historical immutability

A result and its breakdown are frozen at scoring time
(`readiness_results`/`score_breakdowns`) and are never rewritten by
anything in this layer. Two assessments for the same user produce two
independent result rows; viewing or scoring a later assessment does not
touch an earlier one. `backend/tests/test_recommendations.py::test_two_assessments_keep_separate_recommendation_sets`
exercises this end to end.

## Progress / trend

There is no dedicated trend endpoint. `GET /readiness-results` already
returns every result newest-first with `overall_score` and `created_at`;
the frontend's `/history` page derives "first score", "latest score", and
their difference directly from that list (oldest and newest entries)
rather than the backend computing and persisting a derived value.

## Security

Every endpoint here follows: authenticate → permission
(`assessment:read:own`) → ownership → query. Both endpoints are covered by
the mandatory two-user IDOR/BOLA test in `test_readiness_results.py`
(`test_two_user_readiness_result_security`): User A can read their own
result, cannot read User B's result via User B's assessment id, and User
A's history never contains User B's rows.

## Audit logging

`READINESS_RESULT_VIEWED` is logged on `GET /assessments/{id}/result`
(in `app/api/routes/assessments.py`, alongside the scoring route). No
income/debt/credit/savings values are ever written to `audit_logs`.

## Frontend

- `/results/{assessmentId}` - overall score, readiness level badge, score
  breakdown bars with explanations, "Areas to Focus On" (client-side: the
  two lowest-scoring categories below the same 75 "Ready" ceiling
  `recommendations.py` uses, so a category is never called out once it's
  already strong - see `docs/recommendations.md`), recommendations, and
  the required disclaimer.
- `/history` - table of past results (date/score/level), with a
  first-vs-latest score delta and a link into each result's `/results`
  page.
- `/assessments`, `/assessments/new`, `/assessments/{id}` (`docs/assessments.md`)
  are what actually gets a user to a scored result in the first place -
  create a draft, fill it in, submit, and the score/result pages above
  take over from there.

## Not implemented here

No AI, no document upload, no admin dashboard, no real-estate connection
workflow, no score recalculation. See `docs/recommendations.md` for the
rule-based recommendation engine that lives alongside this layer.
