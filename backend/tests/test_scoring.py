"""
Unit tests for the pure HomeReady v1 scoring engine (app/services/scoring.py).

No database, no HTTP - these run unconditionally, unlike the DATABASE_URL
-gated integration tests elsewhere in this suite.
"""
from decimal import Decimal

import pytest

from app.services.scoring import (
    WEIGHTS,
    ScoringComponent,
    calculate_credit_score,
    calculate_debt_score,
    calculate_down_payment_score,
    calculate_employment_score,
    calculate_financial_stability_score,
    calculate_overall_score,
    calculate_savings_score,
    explanation_for,
    readiness_level_for_score,
    score_assessment,
)

D = Decimal


# --- Financial stability ----------------------------------------------


@pytest.mark.parametrize(
    "income,expected",
    [
        (D("0"), 0),  # minimum
        (D("10000"), 0),  # below floor threshold
        (D("20000"), 0),  # floor boundary
        (D("85000"), 50),  # middle
        (D("150000"), 100),  # ceiling boundary
        (D("500000"), 100),  # above ceiling, capped
    ],
)
def test_financial_stability_score(income, expected) -> None:
    assert calculate_financial_stability_score(income) == expected


# --- Debt management ----------------------------------------------------


@pytest.mark.parametrize(
    "income,monthly_debt,expected",
    [
        (D("72000"), D("0"), 100),  # ratio = 0, minimum
        (D("72000"), D("600"), 100),  # ratio = 0.10, below excellent threshold
        (D("72000"), D("900"), 100),  # ratio = 0.15, excellent boundary
        (D("72000"), D("1800"), 60),  # ratio = 0.30, middle of first segment
        (D("72000"), D("2700"), 20),  # ratio = 0.45, elevated boundary
        (D("72000"), D("3150"), 10),  # ratio = 0.525, middle of second segment
        (D("72000"), D("3600"), 0),  # ratio = 0.60, ceiling boundary
        (D("72000"), D("6000"), 0),  # ratio = 1.0, above ceiling
        (D("0"), D("0"), 100),  # no income, no debt: neutral
        (D("0"), D("500"), 0),  # no income, any debt: worst case
    ],
)
def test_debt_score(income, monthly_debt, expected) -> None:
    assert calculate_debt_score(income, monthly_debt) == expected


# --- Credit ---------------------------------------------------------------


@pytest.mark.parametrize(
    "credit_score,expected",
    [
        (300, 20),  # minimum
        (579, 20),  # band 1 upper boundary
        (580, 50),  # band 2 lower boundary
        (669, 50),  # band 2 upper boundary
        (670, 75),  # band 3 lower boundary
        (739, 75),  # band 3 upper boundary
        (740, 90),  # band 4 lower boundary
        (799, 90),  # band 4 upper boundary
        (800, 100),  # band 5 lower boundary
        (850, 100),  # maximum
    ],
)
def test_credit_score(credit_score, expected) -> None:
    assert calculate_credit_score(credit_score) == expected


# --- Down payment ---------------------------------------------------------


@pytest.mark.parametrize(
    "down_payment,target_home_price,expected",
    [
        (D("0"), D("300000"), 0),  # minimum
        (D("15000"), D("300000"), 25),  # ratio = 0.05, below threshold
        (D("30000"), D("300000"), 50),  # ratio = 0.10, middle
        (D("60000"), D("300000"), 100),  # ratio = 0.20, target boundary
        (D("150000"), D("300000"), 100),  # ratio = 0.50, above target, capped
        (D("300000"), D("300000"), 100),  # down payment == price
        (D("400000"), D("300000"), 100),  # down payment > price
    ],
)
def test_down_payment_score(down_payment, target_home_price, expected) -> None:
    assert calculate_down_payment_score(down_payment, target_home_price) == expected


def test_down_payment_score_handles_invalid_price_safely() -> None:
    # Should already be rejected by assessment validation - the engine
    # still must not divide by zero if invalid data somehow reaches it.
    assert calculate_down_payment_score(D("10000"), D("0")) == 0
    assert calculate_down_payment_score(D("10000"), D("-1")) == 0


# --- Savings ----------------------------------------------------------------


@pytest.mark.parametrize(
    "savings,down_payment,target_home_price,expected",
    [
        (D("20000"), D("20000"), D("300000"), 0),  # no cushion beyond down payment
        (D("10000"), D("20000"), D("300000"), 0),  # savings below down payment, floored not negative
        (D("35000"), D("20000"), D("300000"), 50),  # extra = 15000, ratio = 0.05
        (D("50000"), D("20000"), D("300000"), 100),  # extra = 30000, ratio = 0.10 boundary
        (D("200000"), D("20000"), D("300000"), 100),  # large cushion, capped
    ],
)
def test_savings_score(savings, down_payment, target_home_price, expected) -> None:
    assert calculate_savings_score(savings, down_payment, target_home_price) == expected


# --- Employment stability ------------------------------------------------


@pytest.mark.parametrize(
    "employment_years,expected",
    [
        (D("0"), 0),  # minimum
        (D("2"), 40),  # below threshold
        (D("2.5"), 50),  # middle
        (D("5"), 100),  # ceiling boundary
        (D("10"), 100),  # above ceiling, capped
    ],
)
def test_employment_score(employment_years, expected) -> None:
    assert calculate_employment_score(employment_years) == expected


# --- Overall score / readiness level --------------------------------------


def test_overall_score_matches_manual_weighted_sum() -> None:
    # financial=40, debt=87, credit=75, down_payment=33, savings=33, employment=60
    scores = {
        "financial_stability": 40,
        "debt_management": 87,
        "credit": 75,
        "down_payment": 33,
        "savings": 33,
        "employment_stability": 60,
    }
    expected = round(
        40 * 0.25 + 87 * 0.25 + 75 * 0.20 + 33 * 0.15 + 33 * 0.10 + 60 * 0.05
    )
    assert expected == 58
    assert calculate_overall_score(scores) == 58


@pytest.mark.parametrize(
    "score,expected_level",
    [
        (0, "NOT_READY"),
        (39, "NOT_READY"),
        (40, "NEEDS_IMPROVEMENT"),
        (59, "NEEDS_IMPROVEMENT"),
        (60, "ALMOST_READY"),
        (74, "ALMOST_READY"),
        (75, "READY"),
        (89, "READY"),
        (90, "HIGHLY_READY"),
        (100, "HIGHLY_READY"),
    ],
)
def test_readiness_level_bands(score, expected_level) -> None:
    assert readiness_level_for_score(score) == expected_level


def test_weights_sum_to_one() -> None:
    assert sum(WEIGHTS.values()) == D("1.00")


# --- Explanations -----------------------------------------------------------


def test_explanation_for_every_category_and_tier() -> None:
    for category in WEIGHTS:
        for score in (95, 70, 10):
            explanation = explanation_for(category, score)
            assert isinstance(explanation, str)
            assert len(explanation) > 0


# --- score_assessment (full orchestration) -----------------------------


def _complete_assessment(**overrides) -> dict:
    base = {
        "income": D("72000"),
        "monthly_debt": D("1200"),
        "credit_score": 720,
        "savings": D("30000"),
        "down_payment": D("20000"),
        "target_home_price": D("300000"),
        "employment_years": D("3.0"),
    }
    base.update(overrides)
    return base


def test_score_assessment_worked_example() -> None:
    result = score_assessment(_complete_assessment())
    assert result.scoring_version == "v1"
    assert result.overall_score == 58
    assert result.readiness_level == "NEEDS_IMPROVEMENT"
    assert {c.category for c in result.components} == set(WEIGHTS.keys())

    by_category = {c.category: c for c in result.components}
    assert by_category["financial_stability"].score == 40
    assert by_category["debt_management"].score == 87
    assert by_category["credit"].score == 75
    assert by_category["down_payment"].score == 33
    assert by_category["savings"].score == 33
    assert by_category["employment_stability"].score == 60


def test_score_assessment_never_produces_out_of_range_values() -> None:
    # Extreme but individually-valid inputs (per assessment field validation).
    extreme = _complete_assessment(
        income=D("0"),
        monthly_debt=D("9999999999.99"),
        credit_score=300,
        savings=D("0"),
        down_payment=D("0"),
        target_home_price=D("0.01"),
        employment_years=D("0"),
    )
    result = score_assessment(extreme)
    assert 0 <= result.overall_score <= 100
    for component in result.components:
        assert 0 <= component.score <= 100
        assert isinstance(component, ScoringComponent)


def test_score_assessment_high_end_extreme() -> None:
    # down_payment and savings are both huge relative to a tiny target price
    # so every ratio-based category caps at 100 - savings is well above
    # down_payment too, so the "cushion beyond down payment" isn't zeroed out.
    extreme = _complete_assessment(
        income=D("9999999999.99"),
        monthly_debt=D("0"),
        credit_score=850,
        savings=D("9999999999.99"),
        down_payment=D("100.00"),
        target_home_price=D("0.01"),
        employment_years=D("999.9"),
    )
    result = score_assessment(extreme)
    assert result.overall_score == 100
    assert result.readiness_level == "HIGHLY_READY"
