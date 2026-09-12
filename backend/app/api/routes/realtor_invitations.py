from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection

from app.api.deps import get_db
from app.schemas.realtors import (
    RealtorInviteAcceptRequest,
    RealtorInviteLookupRequest,
    RealtorInviteLookupResponse,
)
from app.schemas.users import UserPublic
from app.services import realtor_invitations

router = APIRouter(prefix="/realtor-invitations", tags=["realtor-invitations"])


def _invalid() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This invitation link is invalid or has expired",
    )


@router.post("/lookup", response_model=RealtorInviteLookupResponse)
def lookup(data: RealtorInviteLookupRequest, conn: Connection = Depends(get_db)) -> RealtorInviteLookupResponse:
    """Public, unauthenticated: validates a token without consuming it, so the
    frontend can show the right onboarding form. See docs/realtor-onboarding.md."""
    try:
        result = realtor_invitations.lookup_invitation(conn, token=data.token)
    except realtor_invitations.InvalidInvitation as exc:
        raise _invalid() from exc
    return RealtorInviteLookupResponse(**result)


@router.post("/accept", response_model=UserPublic)
def accept(data: RealtorInviteAcceptRequest, conn: Connection = Depends(get_db)) -> UserPublic:
    try:
        user_row = realtor_invitations.accept_invitation(
            conn,
            token=data.token,
            first_name=data.first_name,
            last_name=data.last_name,
            password=data.password,
        )
    except realtor_invitations.InvalidInvitation as exc:
        raise _invalid() from exc
    except realtor_invitations.MissingOnboardingFields as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required fields: {', '.join(exc.missing)}",
        ) from exc
    return UserPublic(**user_row)
