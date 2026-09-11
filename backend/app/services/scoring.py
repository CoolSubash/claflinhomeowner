"""
HomeReady v1 deterministic readiness scoring engine.

Pure functions only: no SQL, no FastAPI request objects, no AI. Every
function here is a plain, deterministic transformation of Decimal/int
inputs to a 0-100 score, so the same assessment always produces the same
result under the same scoring version (see docs/scoring-v1.md for the
full methodology writeup and a worked example).

Naming and category weights follow the "Phase 6: Deterministic Readiness
Scoring Engine" spec exactly. Two of that spec's illustrative labels don't
match the schema the Phase 2 migrations actually created - `docs/scoring-v1.md`
explains why the code below intentionally uses `ALMOST_READY` (not the
spec's `MODERATELY_READY`) and lowercase snake_case categories like
`financial_stability` (not `FINANCIAL_STABILITY`): both are hard
CHECK-constrained values in the database, and "follow the existing schema"
takes precedence over an illustrative label in a prompt.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

SCORING_VERSION = "v1"

# Category order here is also the canonical order used everywhere else in
# this module (component lists, the worked example, etc).
WEIGHTS: dict[str, Decimal] = {
    "financial_stability": Decimal("0.25"),
    "debt_management": Decimal("0.25"),
    "credit": Decimal("0.20"),
    "down_payment": Decimal("0.15"),
    "savings": Decimal("0.10"),
    "employment_stability": Decimal("0.05"),
}

assert sum(WEIGHTS.values()) == Decimal("1.00"), "HomeReady v1 category weights must sum to 1.0"

# (low, high, level) - inclusive bounds, evaluated low to high.
READINESS_BANDS: list[tuple[int, int, str]] = [
    (0, 39, "NOT_READY"),
    (40, 59, "NEEDS_IMPROVEMENT"),
    (60, 74, "ALMOST_READY"),
    (75, 89, "READY"),
    (90, 100, "HIGHLY_READY"),
]

# --- Category-specific documented thresholds --------------------------

_FINANCIAL_STABILITY_MIN_INCOME = Decimal("20000")
_FINANCIAL_STABILITY_MAX_INCOME = Decimal("150000")

_DEBT_RATIO_EXCELLENT = Decimal("0.15")
_DEBT_RATIO_ELEVATED = Decimal("0.45")
_DEBT_RATIO_CEILING = Decimal("0.60")

_CREDIT_BANDS = (
    (580, 20),  # 300-579
    (670, 50),  # 580-669
    (740, 75),  # 670-739
    (800, 90),  # 740-799
)  # 800-850 -> 100, handled as the fallthrough case

_DOWN_PAYMENT_TARGET_RATIO = Decimal("0.20")
_SAVINGS_CUSHION_TARGET_RATIO = Decimal("0.10")
_EMPLOYMENT_YEARS_TARGET = Decimal("5")


def _round_score(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _clamp(value: int, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, value))


def calculate_financial_stability_score(income: Decimal) -> int:
    """
    Linear from $20,000/yr (0) to $150,000/yr (100). Income alone does not
    fully represent financial stability - this is a deliberately narrow v1
    proxy, documented as such in docs/scoring-v1.md.
    """
    if income <= _FINANCIAL_STABILITY_MIN_INCOME:
        return 0
    if income >= _FINANCIAL_STABILITY_MAX_INCOME:
        return 100
    span = _FINANCIAL_STABILITY_MAX_INCOME - _FINANCIAL_STABILITY_MIN_INCOME
    fraction = (income - _FINANCIAL_STABILITY_MIN_INCOME) / span
    return _clamp(_round_score(fraction * 100))


def calculate_debt_score(income: Decimal, monthly_debt: Decimal) -> int:
    """
    HomeReady debt burden indicator - not an official lender DTI figure.
    Ratio = monthly_debt / (annual income / 12).

    ratio <= 0.15            -> 100
    0.15 < ratio <= 0.45      -> linear 100 -> 20
    0.45 < ratio <= 0.60      -> linear 20 -> 0
    ratio > 0.60              -> 0

    income == 0 is handled explicitly rather than dividing by zero: no
    income and no debt is treated as neutral (100); no income with any
    debt is the worst case (0).
    """
    monthly_income = income / 12
    if monthly_income <= 0:
        return 100 if monthly_debt <= 0 else 0

    ratio = monthly_debt / monthly_income
    if ratio <= _DEBT_RATIO_EXCELLENT:
        return 100
    if ratio >= _DEBT_RATIO_CEILING:
        return 0
    if ratio <= _DEBT_RATIO_ELEVATED:
        span = _DEBT_RATIO_ELEVATED - _DEBT_RATIO_EXCELLENT
        fraction = (ratio - _DEBT_RATIO_EXCELLENT) / span
        return _clamp(_round_score(100 - fraction * 80))

    span = _DEBT_RATIO_CEILING - _DEBT_RATIO_ELEVATED
    fraction = (ratio - _DEBT_RATIO_ELEVATED) / span
    return _clamp(_round_score(20 - fraction * 20))


def calculate_credit_score(credit_score: int) -> int:
    """
    Banded mapping from the validated 300-850 input range to a HomeReady
    v1 credit component - not a lender qualification claim.

    300-579 -> 20   580-669 -> 50   670-739 -> 75
    740-799 -> 90   800-850 -> 100
    """
    for upper_exclusive, score in _CREDIT_BANDS:
        if credit_score < upper_exclusive:
            return score
    return 100


def calculate_down_payment_score(down_payment: Decimal, target_home_price: Decimal) -> int:
    """
    down_payment / target_home_price, linear from 0% (0) to 20% (100).
    20% is used only as this v1 methodology's own internal reference
    point - never represented as "guaranteeing" anything.
    """
    if target_home_price <= 0:
        # Should already be rejected by assessment validation; fail safe
        # rather than divide by zero if invalid data somehow reaches here.
        return 0
    if down_payment <= 0:
        return 0

    ratio = down_payment / target_home_price
    if ratio >= _DOWN_PAYMENT_TARGET_RATIO:
        return 100
    return _clamp(_round_score((ratio / _DOWN_PAYMENT_TARGET_RATIO) * 100))


def calculate_savings_score(savings: Decimal, down_payment: Decimal, target_home_price: Decimal) -> int:
    """
    Savings *beyond* the planned down payment, as a percentage of the
    target home price - linear from 0% (0) to 10% (100).

    This explicitly avoids double-counting: dollars already credited to
    the Down Payment category aren't credited again here. If savings are
    less than or equal to the planned down payment, this category scores 0
    (there is no cushion beyond what's earmarked), not a negative number.
    """
    if target_home_price <= 0:
        return 0

    extra_savings = max(Decimal(0), savings - down_payment)
    ratio = extra_savings / target_home_price
    if ratio >= _SAVINGS_CUSHION_TARGET_RATIO:
        return 100
    return _clamp(_round_score((ratio / _SAVINGS_CUSHION_TARGET_RATIO) * 100))


def calculate_employment_score(employment_years: Decimal) -> int:
    """Linear from 0 years (0) to 5 years (100)."""
    if employment_years <= 0:
        return 0
    if employment_years >= _EMPLOYMENT_YEARS_TARGET:
        return 100
    return _clamp(_round_score((employment_years / _EMPLOYMENT_YEARS_TARGET) * 100))


def calculate_overall_score(component_scores: dict[str, int]) -> int:
    """Weighted sum of the six category scores, rounded and clamped to 0-100."""
    total = sum(Decimal(component_scores[category]) * weight for category, weight in WEIGHTS.items())
    return _clamp(_round_score(total))


def readiness_level_for_score(overall_score: int) -> str:
    for low, high, level in READINESS_BANDS:
        if low <= overall_score <= high:
            return level
    raise ValueError(f"overall_score {overall_score} is outside 0-100")  # unreachable if callers clamp


_EXPLANATIONS: dict[str, dict[str, str]] = {
    "financial_stability": {
        "high": "Your income comfortably meets the HomeReady v1 financial stability benchmark.",
        "mid": "Your income partially meets the HomeReady v1 financial stability benchmark; increasing it would raise this score.",
        "low": "Your income is below the HomeReady v1 financial stability benchmark for this category.",
    },
    "debt_management": {
        "high": "Your monthly debt represents a relatively small portion of your estimated monthly income under the HomeReady v1 methodology.",
        "mid": "Your monthly debt represents a moderate portion of your estimated monthly income under the HomeReady v1 methodology.",
        "low": "Your monthly debt represents a large portion of your estimated monthly income under the HomeReady v1 methodology; reducing it would raise this score.",
    },
    "credit": {
        "high": "Your credit score falls in a strong HomeReady v1 credit band.",
        "mid": "Your credit score falls in a moderate HomeReady v1 credit band.",
        "low": "Your credit score falls in a lower HomeReady v1 credit band; improving it would raise this score.",
    },
    "down_payment": {
        "high": "Your planned down payment is at or near the HomeReady v1 20% reference point.",
        "mid": "Your planned down payment covers a partial percentage of the target home price under the HomeReady v1 methodology.",
        "low": "Your planned down payment covers a small percentage of the target home price under the HomeReady v1 methodology.",
    },
    "savings": {
        "high": "Beyond your planned down payment, you have a strong savings cushion under the HomeReady v1 methodology.",
        "mid": "Beyond your planned down payment, you have a moderate savings cushion under the HomeReady v1 methodology.",
        "low": "Beyond your planned down payment, your additional savings cushion is limited under the HomeReady v1 methodology.",
    },
    "employment_stability": {
        "high": "Your employment history meets the HomeReady v1 stability benchmark.",
        "mid": "Your employment history partially meets the HomeReady v1 stability benchmark.",
        "low": "Your employment history is below the HomeReady v1 stability benchmark for this category.",
    },
}


def explanation_for(category: str, score: int) -> str:
    tier = "high" if score >= 80 else "mid" if score >= 60 else "low"
    return _EXPLANATIONS[category][tier]


@dataclass(frozen=True)
class ScoringComponent:
    category: str
    score: int
    weight: Decimal
    raw_value: Decimal
    explanation: str


@dataclass(frozen=True)
class ScoringResult:
    scoring_version: str
    overall_score: int
    readiness_level: str
    components: list[ScoringComponent]


def score_assessment(assessment: dict) -> ScoringResult:
    """
    assessment must already be SUBMITTED - i.e. every field below is
    guaranteed non-null by app/services/assessments.py's submit validation.
    This function does not touch the database and does not know about
    assessment status; that check belongs to the caller.
    """
    income = assessment["income"]
    monthly_debt = assessment["monthly_debt"]
    credit_score_value = assessment["credit_score"]
    savings = assessment["savings"]
    down_payment = assessment["down_payment"]
    target_home_price = assessment["target_home_price"]
    employment_years = assessment["employment_years"]

    scores = {
        "financial_stability": calculate_financial_stability_score(income),
        "debt_management": calculate_debt_score(income, monthly_debt),
        "credit": calculate_credit_score(credit_score_value),
        "down_payment": calculate_down_payment_score(down_payment, target_home_price),
        "savings": calculate_savings_score(savings, down_payment, target_home_price),
        "employment_stability": calculate_employment_score(employment_years),
    }

    overall_score = calculate_overall_score(scores)
    readiness_level = readiness_level_for_score(overall_score)

    monthly_income = income / 12
    debt_ratio_pct = (monthly_debt / monthly_income * 100) if monthly_income > 0 else Decimal(0)
    down_payment_pct = (down_payment / target_home_price * 100) if target_home_price > 0 else Decimal(0)
    extra_savings = max(Decimal(0), savings - down_payment)

    raw_values: dict[str, Decimal] = {
        "financial_stability": income,
        "debt_management": debt_ratio_pct,
        "credit": Decimal(credit_score_value),
        "down_payment": down_payment_pct,
        "savings": extra_savings,
        "employment_stability": employment_years,
    }

    components = [
        ScoringComponent(
            category=category,
            score=scores[category],
            weight=weight,
            raw_value=raw_values[category].quantize(Decimal("0.01")),
            explanation=explanation_for(category, scores[category]),
        )
        for category, weight in WEIGHTS.items()
    ]

    result = ScoringResult(
        scoring_version=SCORING_VERSION,
        overall_score=overall_score,
        readiness_level=readiness_level,
        components=components,
    )
    _validate_result(result)
    return result


def _validate_result(result: ScoringResult) -> None:
    """Score calculation integrity check - see Phase 6 spec."""
    assert result.scoring_version == SCORING_VERSION
    assert 0 <= result.overall_score <= 100
    assert {c.category for c in result.components} == set(WEIGHTS.keys())
    for component in result.components:
        assert 0 <= component.score <= 100
