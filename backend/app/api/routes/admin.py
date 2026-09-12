from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection

from app.api.deps import get_db, get_email_service, require_permission
from app.schemas.authorization import AuthorizationContext
from app.schemas.realtors import (
    RealEstatePartnerCreate,
    RealEstatePartnerPublic,
    RealtorInviteCreate,
)
from app.schemas.users import UserWithRoles
from app.services import realtor_invitations, realtor_partners
from app.services.audit import log_event
from app.services.email.base import EmailService
from app.services.users import list_users_with_roles

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserWithRoles])
def list_users(
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("user:read:any")),
) -> list[UserWithRoles]:
    rows = list_users_with_roles(conn)
    log_event(conn, user_id=context.user_id, action="ADMIN_VIEWED_USER", metadata={"count": len(rows)})
    return [UserWithRoles(**row) for row in rows]


@router.post("/realtor-partners", response_model=RealEstatePartnerPublic, status_code=status.HTTP_201_CREATED)
def create_partner(
    data: RealEstatePartnerCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("partner:manage")),
) -> RealEstatePartnerPublic:
    row = realtor_partners.create_partner(
        conn, name=data.name, contact_email=data.contact_email, contact_phone=data.contact_phone
    )
    log_event(
        conn,
        user_id=context.user_id,
        action="REALTOR_PARTNER_CREATED",
        resource_type="real_estate_partner",
        resource_id=row["id"],
    )
    return RealEstatePartnerPublic(**row)


@router.get("/realtor-partners", response_model=list[RealEstatePartnerPublic])
def list_partners(
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("partner:manage")),
) -> list[RealEstatePartnerPublic]:
    return [RealEstatePartnerPublic(**row) for row in realtor_partners.list_partners(conn)]


@router.post("/realtor-partners/{partner_id}/invite", status_code=status.HTTP_204_NO_CONTENT)
def invite_realtor(
    partner_id: UUID,
    data: RealtorInviteCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("partner:manage")),
    email_service: EmailService = Depends(get_email_service),
) -> None:
    partner = realtor_partners.get_partner_by_id(conn, partner_id)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")

    realtor_invitations.create_and_send_invite(
        conn, partner_id=partner_id, email=data.email, invited_by=context.user_id, email_service=email_service
    )
