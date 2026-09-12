from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection

from app.api.deps import get_db, require_permission
from app.schemas.authorization import AuthorizationContext
from app.schemas.connections import ConnectionRequestForRealtor, ConnectionRespondRequest
from app.services import connections
from app.services.audit import log_event
from app.services.realtor_partners import get_partner_by_user_id

router = APIRouter(prefix="/realtor", tags=["realtor"])


def _require_linked_partner(conn: Connection, user_id: UUID) -> dict:
    """
    Every route here needs "which partner record does this caller manage" -
    resolved fresh from the database, never trusted from a client-supplied
    value (same principle as every ownership check elsewhere in the app).
    A REALTOR-permissioned account with no linked partner is a data
    inconsistency (onboarding always links one), so it's safe to be
    specific here - this only ever describes the caller's own account.
    """
    partner = get_partner_by_user_id(conn, user_id)
    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No real-estate partner record is linked to this account",
        )
    return partner


@router.get("/connection-requests", response_model=list[ConnectionRequestForRealtor])
def list_connection_requests(
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("connection:respond:own")),
) -> list[ConnectionRequestForRealtor]:
    partner = _require_linked_partner(conn, context.user_id)
    rows = connections.list_connection_requests_for_partner(conn, partner["id"])
    return [ConnectionRequestForRealtor(**row) for row in rows]


@router.post("/connection-requests/{request_id}/respond", response_model=ConnectionRequestForRealtor)
def respond_to_connection_request(
    request_id: UUID,
    data: ConnectionRespondRequest,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("connection:respond:own")),
) -> ConnectionRequestForRealtor:
    partner = _require_linked_partner(conn, context.user_id)
    try:
        row = connections.respond_to_connection_request(
            conn, request_id=request_id, partner_id=partner["id"], status=data.status
        )
    except connections.ConnectionRequestNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connection request not found") from exc

    log_event(
        conn,
        user_id=context.user_id,
        action="CONNECTION_REQUEST_RESPONDED",
        resource_type="connection_request",
        resource_id=request_id,
        metadata={"status": data.status},
    )
    return ConnectionRequestForRealtor(**row)
