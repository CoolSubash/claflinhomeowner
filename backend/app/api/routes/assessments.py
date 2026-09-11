from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg import Connection

from app.api.deps import get_db, require_permission
from app.schemas.assessments import AssessmentCreate, AssessmentPublic, AssessmentUpdate
from app.schemas.authorization import AuthorizationContext
from app.schemas.readiness import ReadinessResultPublic
from app.services import assessments as assessments_service
from app.services import readiness_results as readiness_results_service
from app.services.audit import log_event
from app.services.ownership import get_owned_assessment

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")


@router.post("", response_model=AssessmentPublic, status_code=status.HTTP_201_CREATED)
def create(
    data: AssessmentCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:create")),
) -> AssessmentPublic:
    row = assessments_service.create_assessment(conn, user_id=context.user_id, data=data)
    log_event(
        conn,
        user_id=context.user_id,
        action="ASSESSMENT_CREATED",
        resource_type="assessment",
        resource_id=row["id"],
    )
    return AssessmentPublic(**row)


@router.get("", response_model=list[AssessmentPublic])
def list_own(
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:read:own")),
) -> list[AssessmentPublic]:
    rows = assessments_service.list_assessments(conn, user_id=context.user_id)
    return [AssessmentPublic(**row) for row in rows]


@router.get("/{assessment_id}", response_model=AssessmentPublic)
def get_one(
    assessment_id: UUID,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:read:own")),
) -> AssessmentPublic:
    row = get_owned_assessment(conn, assessment_id, context.user_id)
    if row is None:
        raise _not_found()

    log_event(
        conn,
        user_id=context.user_id,
        action="ASSESSMENT_VIEWED",
        resource_type="assessment",
        resource_id=assessment_id,
    )
    return AssessmentPublic(**row)


@router.patch("/{assessment_id}", response_model=AssessmentPublic)
def update(
    assessment_id: UUID,
    data: AssessmentUpdate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:update:own")),
) -> AssessmentPublic:
    try:
        row = assessments_service.update_assessment(
            conn, assessment_id=assessment_id, user_id=context.user_id, data=data
        )
    except assessments_service.AssessmentNotEditable as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment is no longer editable",
        ) from exc

    if row is None:
        raise _not_found()
    return AssessmentPublic(**row)


@router.post("/{assessment_id}/submit", response_model=AssessmentPublic)
def submit(
    assessment_id: UUID,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:update:own")),
) -> AssessmentPublic:
    try:
        row = assessments_service.submit_assessment(
            conn, assessment_id=assessment_id, user_id=context.user_id
        )
    except assessments_service.AssessmentAlreadySubmitted as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment has already been submitted",
        ) from exc
    except assessments_service.AssessmentIncomplete as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Assessment is missing required fields: {', '.join(exc.missing_fields)}",
        ) from exc

    if row is None:
        raise _not_found()

    log_event(
        conn,
        user_id=context.user_id,
        action="ASSESSMENT_SUBMITTED",
        resource_type="assessment",
        resource_id=assessment_id,
    )
    return AssessmentPublic(**row)


@router.post("/{assessment_id}/score", response_model=ReadinessResultPublic)
def score(
    assessment_id: UUID,
    response: Response,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:update:own")),
) -> ReadinessResultPublic:
    try:
        result_row, breakdown_rows, was_created = readiness_results_service.score_and_persist(
            conn, assessment_id=assessment_id, user_id=context.user_id
        )
    except readiness_results_service.AssessmentNotFound as exc:
        raise _not_found() from exc
    except readiness_results_service.AssessmentNotSubmitted as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only a submitted assessment can be scored",
        ) from exc

    if was_created:
        response.status_code = status.HTTP_201_CREATED
        log_event(
            conn,
            user_id=context.user_id,
            action="ASSESSMENT_SCORED",
            resource_type="readiness_result",
            resource_id=result_row["id"],
            metadata={"assessment_id": str(assessment_id), "scoring_version": result_row["scoring_version"]},
        )
    else:
        response.status_code = status.HTTP_200_OK

    return ReadinessResultPublic.from_rows(result_row, breakdown_rows)


@router.get("/{assessment_id}/result", response_model=ReadinessResultPublic)
def get_result(
    assessment_id: UUID,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("assessment:read:own")),
) -> ReadinessResultPublic:
    assessment = get_owned_assessment(conn, assessment_id, context.user_id)
    if assessment is None:
        raise _not_found()

    found = readiness_results_service.get_result_for_assessment(
        conn, assessment_id=assessment_id, user_id=context.user_id
    )
    if found is None:
        # The assessment itself exists and belongs to this caller - safe to
        # be specific here, unlike the ambiguous 404 used for ownership
        # failures (see docs/authorization.md).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No readiness result exists for this assessment yet",
        )
    result_row, breakdown_rows = found

    log_event(
        conn,
        user_id=context.user_id,
        action="READINESS_RESULT_VIEWED",
        resource_type="readiness_result",
        resource_id=result_row["id"],
    )
    return ReadinessResultPublic.from_rows(result_row, breakdown_rows)
