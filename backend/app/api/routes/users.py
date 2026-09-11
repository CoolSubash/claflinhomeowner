from fastapi import APIRouter, Depends
from psycopg import Connection

from app.api.deps import get_db
from app.schemas.users import UserCountResponse
from app.services.users import count_users

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/count", response_model=UserCountResponse)
def get_user_count(conn: Connection = Depends(get_db)) -> UserCountResponse:
    return UserCountResponse(count=count_users(conn))
