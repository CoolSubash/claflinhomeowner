from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg import Connection

from app.api.deps import get_db, require_permission
from app.schemas.authorization import AuthorizationContext
from app.schemas.readiness import ReadinessResultSummary
from app.schemas.recommendations import RecommendationPublic
from app.services.ownership import get_owned_readiness_result
from app.services.audit import log_event
from app.services.readiness_results import list_results_for_user
from app.services.recommendations import get_or_create_recommendations

router = APIRouter(prefix="/readiness-results", tags=["readiness-results"])


@router.get("", response_model=list[ReadinessResultSummary])
def list_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:read:own")),
) -> list[ReadinessResultSummary]:
    # user_id always comes from the authenticated caller's context - never
    # from a query parameter - so there is no way to request another
    # user's history (see docs/authorization.md).
    rows = list_results_for_user(conn, user_id=context.user_id, limit=limit, offset=offset)
    return [ReadinessResultSummary.from_row(row) for row in rows]


@router.get("/{result_id}/recommendations", response_model=list[RecommendationPublic])
def get_recommendations(
    result_id: UUID,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:read:own")),
) -> list[RecommendationPublic]:
    # Recommendations decorate a readiness result, which is itself only
    # reachable through an owned assessment - reuse the same
    # assessment:read:own permission rather than inventing a separate one,
    # and enforce ownership through the readiness_result row directly
    # (see docs/authorization.md).
    result = get_owned_readiness_result(conn, result_id, context.user_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Readiness result not found")

    recommendations = get_or_create_recommendations(
        conn, readiness_result_id=result_id, user_id=context.user_id
    )

    log_event(
        conn,
        user_id=context.user_id,
        action="RECOMMENDATIONS_VIEWED",
        resource_type="readiness_result",
        resource_id=result_id,
    )
    return [RecommendationPublic(**row) for row in recommendations]
