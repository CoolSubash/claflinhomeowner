from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection

from app.api.deps import get_db, require_permission
from app.schemas.authorization import AuthorizationContext
from app.schemas.testimonials import TestimonialCreate, TestimonialPublic
from app.services import testimonials as testimonials_service

router = APIRouter(prefix="/testimonials", tags=["testimonials"])


@router.get("/featured", response_model=list[TestimonialPublic])
def list_featured(conn: Connection = Depends(get_db)) -> list[TestimonialPublic]:
    # Public, unauthenticated: this is marketing content shown to visitors
    # who haven't created an account yet.
    return testimonials_service.list_featured_testimonials(conn, limit=5)


@router.post("", status_code=status.HTTP_201_CREATED)
def create(
    data: TestimonialCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("testimonial:create")),
) -> dict:
    try:
        testimonial_id = testimonials_service.create_testimonial(
            conn, user_id=context.user_id, rating=data.rating, content=data.content
        )
    except testimonials_service.TestimonialAlreadyExists as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already submitted a testimonial",
        ) from exc

    return {"id": str(testimonial_id)}
