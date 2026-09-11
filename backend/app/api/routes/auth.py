import ipaddress

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg import Connection

from app.api.deps import get_current_user, get_db, get_email_service
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.users import UserPublic
from app.services import auth_service, email_verification
from app.services.email.base import EmailService

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip_address = request.client.host if request.client else None
    if ip_address is not None:
        try:
            ipaddress.ip_address(ip_address)
        except ValueError:
            # Not a real IP (e.g. a unix socket peer, a test client, or an
            # unusual proxy setup) - the ip_address column is INET, so
            # storing a non-IP string would fail the query outright.
            ip_address = None
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterRequest,
    request: Request,
    conn: Connection = Depends(get_db),
    email_service: EmailService = Depends(get_email_service),
) -> UserPublic:
    ip_address, user_agent = _client_info(request)
    try:
        user = auth_service.register_user(conn, data, ip_address=ip_address, user_agent=user_agent)
    except auth_service.EmailAlreadyRegistered as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from exc

    email_verification.send_verification_email(
        conn,
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        email_service=email_service,
    )
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, conn: Connection = Depends(get_db)) -> TokenResponse:
    ip_address, user_agent = _client_info(request)
    try:
        _user, access_token, refresh_token, expires_in = auth_service.authenticate_user(
            conn,
            email=data.email,
            password=data.password,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except auth_service.InvalidCredentials as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc
    except auth_service.EmailNotVerified as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before signing in",
        ) from exc

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


@router.post("/verify-email", response_model=UserPublic)
def verify_email(data: VerifyEmailRequest, conn: Connection = Depends(get_db)) -> UserPublic:
    try:
        user_row = email_verification.verify_email_token(conn, token=data.token)
    except email_verification.InvalidVerificationToken as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired",
        ) from exc
    return UserPublic(**user_row)


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
def resend_verification(
    data: ResendVerificationRequest,
    conn: Connection = Depends(get_db),
    email_service: EmailService = Depends(get_email_service),
) -> None:
    # Always 204, whether or not the email is registered or already
    # verified - same user-enumeration-resistance reasoning as /logout.
    email_verification.resend_verification_email(conn, email=data.email, email_service=email_service)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, request: Request, conn: Connection = Depends(get_db)) -> TokenResponse:
    ip_address, user_agent = _client_info(request)
    try:
        access_token, refresh_token, expires_in = auth_service.refresh_access_token(
            conn,
            refresh_token=data.refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except auth_service.InvalidRefreshToken as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(data: LogoutRequest, request: Request, conn: Connection = Depends(get_db)) -> None:
    ip_address, user_agent = _client_info(request)
    auth_service.logout(
        conn,
        refresh_token=data.refresh_token,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get("/me", response_model=UserPublic)
def read_current_user(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return current_user
