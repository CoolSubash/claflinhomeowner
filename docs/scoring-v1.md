# HomeReady Readiness Scoring — v1

## 1. Purpose

This document is the authoritative specification for scoring version
`v1`: what each category measures, exactly how it's calculated, and why.
The implementation lives in `backend/app/services/scoring.py` as pure
functions with no database or HTTP dependency - every example below can
be reproduced by calling those functions directly.

## 2. Disclaimer

The HomeReady readiness score is an **internal educational/decision-support
score**. It is **not**:

* a mortgage approval
* a lender underwriting decision
* a credit score
* a guarantee that a user can purchase a home
* a financial approval
* a substitute for professional financial or mortgage advice

Nothing in this document or its implementation should be read as
representing otherwise. Bands, percentages, and reference points below
(e.g. "20% down payment") are this methodology's own internal anchors,
not lending industry thresholds, even where they resemble commonly-cited
figures.

## 3. Determinism

The same assessment, scored under the same scoring version, always
produces the same result. The engine uses no randomness, no AI/LLM
output, no external API, and no current market data. See
`backend/tests/test_scoring.py` for exhaustive boundary-value tests per
category.

## 4. Input variables

Taken directly from a `SUBMITTED` assessment (`docs/assessments.md`):

| Field | Type | Used by |
|---|---|---|
| `income` | annual, USD | Financial Stability, Debt Management |
| `monthly_debt` | USD | Debt Management |
| `credit_score` | 300-850 | Credit |
| `savings` | USD | Savings |
| `down_payment` | USD | Down Payment, Savings |
| `target_home_price` | USD | Down Payment, Savings |
| `employment_years` | years | Employment Stability |
| `location` | text | **not used** in v1 - see §13 |

## 5-7. Categories, formulas, and normalization

Six categories, each producing an integer 0-100. All values below are the
exact constants in `scoring.py`; nothing here is approximate.

### Financial Stability — weight 25%

Income alone doesn't fully represent financial stability - this is a
deliberately narrow v1 proxy that a future version may expand.

```text
income <= $20,000/yr   -> 0
income >= $150,000/yr  -> 100
otherwise              -> linear: (income - 20000) / (150000 - 20000) * 100
```

### Debt Management — weight 25%

Called the **HomeReady debt burden indicator** - explicitly not an
official lender debt-to-income (DTI) figure. Annual income is converted
to monthly first (`income / 12`), then:

```text
ratio = monthly_debt / monthly_income
```

```text
ratio <= 0.15              -> 100
0.15 < ratio <= 0.45        -> linear: 100 -> 20
0.45 < ratio <= 0.60        -> linear: 20 -> 0
ratio > 0.60                -> 0
```

`monthly_income == 0` is handled explicitly, not by dividing by zero: no
income and no debt scores 100 (neutral - nothing to measure); no income
with any debt scores 0 (worst case).

### Credit — weight 20%

A banded mapping, not `credit_score / 850 * 100` - a straight linear
scale would treat the difference between 300 and 400 the same as the
difference between 750 and 850, which doesn't reflect how differently
those changes matter. These are HomeReady's own educational bands, not a
lender qualification chart:

```text
300-579  -> 20
580-669  -> 50
670-739  -> 75
740-799  -> 90
800-850  -> 100
```

### Down Payment — weight 15%

```text
ratio = down_payment / target_home_price

ratio <= 0    -> 0
ratio >= 0.20 -> 100
otherwise     -> linear: (ratio / 0.20) * 100
```

20% is used only as this methodology's own internal reference point.
`target_home_price <= 0` returns 0 rather than dividing by zero - this
should already be rejected by assessment validation (`docs/assessments.md`),
but the engine fails safe regardless.

### Savings — weight 10%

Savings matter beyond the down payment, but the same dollars must not be
credited twice. This category measures the cushion **beyond** what's
already earmarked for the down payment:

```text
extra_savings = max(0, savings - down_payment)
ratio = extra_savings / target_home_price

ratio >= 0.10 -> 100
otherwise     -> linear: (ratio / 0.10) * 100
```

If `savings <= down_payment`, `extra_savings` is 0 and this category
scores 0 - not negative. A future version may add explicit fields for
emergency fund, closing costs, or cash reserves; today's assessment
schema has none of those, so this category only ever works from `savings`
and `down_payment`.

### Employment Stability — weight 5%

```text
employment_years <= 0  -> 0
employment_years >= 5  -> 100
otherwise               -> linear: (employment_years / 5) * 100
```

Employment history alone does not determine mortgage approval; this is a
narrow v1 signal only.

## 8. Category weights

```text
Financial Stability       25%
Debt Management            25%
Credit                     20%
Down Payment               15%
Savings                    10%
Employment Stability        5%
                          ----
                          100%
```

`scoring.py` asserts these sum to exactly `1.00` at import time.

```text
overall_score =
    financial_stability * 0.25
  + debt_management     * 0.25
  + credit              * 0.20
  + down_payment        * 0.15
  + savings             * 0.10
  + employment_stability * 0.05
```

These weights are product methodology, not universal financial or
lending standards, and are expected to be refined in a future scoring
version - never represented to users as official mortgage-qualification
criteria. This document and `scoring.py` are the actual, versioned `v1`
implementation and are the single source of truth for the weights in use
today.

## 9. Readiness-level thresholds

```text
0-39    NOT_READY
40-59   NEEDS_IMPROVEMENT
60-74   ALMOST_READY
75-89   READY
90-100  HIGHLY_READY
```

These are **HomeReady educational readiness levels**, not mortgage
approval categories.

**Naming note:** the `readiness_results.status` column's `CHECK`
constraint (migration `81b554a986a8`) uses `ALMOST_READY` for the 60-74
band; the code matches the schema exactly rather than introducing a
different label anywhere else. Same reasoning applies to
`score_breakdowns.category`: its `CHECK` constraint requires lowercase
snake_case
(`financial_stability`, not `FINANCIAL_STABILITY`), which is what
`scoring.py`'s `WEIGHTS` dict keys and every category string use
throughout - database and code agree; only this document's plain-English
headings above are capitalized for readability.

## 10. Rounding

Every category score and the overall score are rounded to the nearest
integer using round-half-up (`ROUND_HALF_UP`, e.g. `86.5 -> 87`), then
clamped to `[0, 100]` as a final safety net. Category scores are computed
independently before the overall weighted sum, so rounding happens twice
(once per category, once for the overall score) - this means the overall
score can differ by ±1 from summing the *unrounded* category values. This
is intentional: every number the user ever sees (each category score
*and* the overall score) is one that was actually rounded the same way,
with no hidden extra precision anywhere in the chain.

## 11. Edge cases

All of the following are covered by `backend/tests/test_scoring.py`:

| Input | Behavior |
|---|---|
| `income = 0` | Financial Stability = 0; Debt Management = 100 if debt is also 0, else 0 |
| `monthly_debt = 0` | Debt Management = 100 |
| `credit_score = 300` / `850` | Credit = 20 / 100 (band floor/ceiling) |
| `savings = 0` | Savings = 0 |
| `down_payment = 0` | Down Payment = 0; Savings measured against full `savings` value |
| `target_home_price` at its minimum valid value (`$0.01`) | Down Payment and Savings both saturate toward 100 for any positive down payment/savings |
| `employment_years = 0` | Employment Stability = 0 |
| Very high income/savings/down payment | All ratio-based categories cap at 100, never overflow |
| Very high debt | Debt Management floors at 0, never goes negative |
| `down_payment >= target_home_price` | Down Payment = 100 (ratio capped, no error) |

The engine never produces `NaN`, `Infinity`, `None`, a negative score, or
a score above 100 - `_clamp` and the explicit zero-division guards in
`calculate_debt_score` / `calculate_down_payment_score` /
`calculate_savings_score` guarantee this structurally, and
`_validate_result` asserts it before every result is returned.

## 12. Scoring version

Every result is computed under `scoring_version = "v1"` and that string
is what's stored (via `readiness_results.scoring_version_id`, a foreign
key to the `scoring_versions` table seeded by migration `3d5368a4a92f`).
`scoring.py`'s `WEIGHTS`/`READINESS_BANDS` constants are the executable
source of truth; the seeded `scoring_versions` row is a read-only
reference/audit snapshot of the same numbers, never read back into the
calculation itself.

## 13. Historical result behavior

Once a `readiness_results` row exists for an assessment, it is never
updated to reflect a later assessment or a later scoring version. A new
assessment always produces a new, separate result row. A unique index on
`(assessment_id, scoring_version_id)` enforces "one canonical `v1` result
per assessment" at the database level - see `docs/assessments.md`.

`location` is intentionally never used in v1 scoring, and is not required
to submit an assessment - no hidden geographic assumption is baked into
any category above.

## 14. Why AI is not used to calculate the score

Every formula above is explicit, versioned, and testable - the same
assessment always produces the same result under the same version. An
LLM cannot make that guarantee: its output can vary between calls, is
expensive to audit line-by-line, and would make "why did my score change"
unanswerable in the deterministic way §5-7 require. AI is reserved for a
later phase's job - explaining an already-calculated result and holding a
conversation about it - never for deciding what the result is.

---

## Worked example

```text
Assessment
--------------------------------
Income:              $72,000
Monthly debt:         $1,200
Credit score:             720
Savings:              $30,000
Down payment:         $20,000
Target home price:  $300,000
Employment:              3 yrs
```

Step by step:

```text
Financial Stability
  (72,000 - 20,000) / (150,000 - 20,000) * 100 = 40.00        -> 40

Debt Management
  monthly income = 72,000 / 12 = 6,000
  ratio = 1,200 / 6,000 = 0.20  (between 0.15 and 0.45)
  100 - ((0.20 - 0.15) / (0.45 - 0.15)) * 80 = 86.67           -> 87

Credit
  720 falls in the 670-739 band                                -> 75

Down Payment
  ratio = 20,000 / 300,000 = 0.0667  (below 0.20)
  (0.0667 / 0.20) * 100 = 33.33                                -> 33

Savings
  extra = max(0, 30,000 - 20,000) = 10,000
  ratio = 10,000 / 300,000 = 0.0333  (below 0.10)
  (0.0333 / 0.10) * 100 = 33.33                                -> 33

Employment Stability
  (3 / 5) * 100 = 60.00                                        -> 60
```

```text
Overall Score =
    40 * 0.25 = 10.00
  + 87 * 0.25 = 21.75
  + 75 * 0.20 = 15.00
  + 33 * 0.15 =  4.95
  + 33 * 0.10 =  3.30
  + 60 * 0.05 =  3.00
                -------
                58.00  -> 58

Overall Score = 58/100
Readiness Level = NEEDS_IMPROVEMENT
```

This exact example is asserted verbatim in
`test_score_assessment_worked_example` in
`backend/tests/test_scoring.py` and in
`test_score_submitted_assessment_succeeds` in
`backend/tests/test_readiness_results.py` - if the formula ever changes,
those tests (and this document) must be updated together.
