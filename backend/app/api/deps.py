from collections.abc import Callable, Iterator
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import Connection

from app.core.config import get_settings
from app.db.connection import get_connection
from app.schemas.authorization import AuthorizationContext
from app.schemas.users import UserPublic
from app.security.tokens import TokenError, decode_access_token
from app.services.ai.anthropic_provider import AnthropicAIService
from app.services.ai.base import AIProviderNotConfigured, AIService
from app.services.audit import log_event
from app.services.auth_service import get_user_by_id
from app.services.authorization import get_user_roles_and_permissions
from app.services.email.base import EmailService
from app.services.email.console_provider import ConsoleEmailService

_bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Connection]:
    with get_connection() as conn:
        yield conn


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    conn: Connection = Depends(get_db),
) -> UserPublic:
    if credentials is None:
        raise _unauthorized()

    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise _unauthorized() from exc

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise _unauthorized() from exc

    # The JWT alone only proves the token was valid at issuance time - the
    # account's current status (e.g. deactivated since) always comes from
    # the database, not from trusting claims in an already-issued token.
    user = get_user_by_id(conn, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()

    return user


def get_authorization_context(
    current_user: UserPublic = Depends(get_current_user),
    conn: Connection = Depends(get_db),
) -> AuthorizationContext:
    """
    Resolve `current_user`'s roles/permissions from the database. Since
    `get_current_user` already rejects inactive users with 401, a caller
    can never reach here without `is_active=True` - authentication and
    authorization stay layered rather than re-checked in both places.
    """
    roles, permissions = get_user_roles_and_permissions(conn, current_user.id)
    return AuthorizationContext(
        user_id=current_user.id,
        is_active=current_user.is_active,
        roles=roles,
        permissions=permissions,
    )


def require_permission(
    permission: str,
) -> Callable[[Connection, AuthorizationContext], AuthorizationContext]:
    """
    Reusable FastAPI dependency factory:

        @router.get(...)
        def route(context: AuthorizationContext = Depends(require_permission("assessment:read:own"))):
            ...

    Denials are audit-logged as UNAUTHORIZED_ACCESS_ATTEMPT before the
    403 is raised. The 403 propagates back through get_db's dependency
    generator, which rolls back the connection on any exception - so the
    audit entry is committed explicitly here first, the same pattern
    auth_service uses for failed-login/refresh-reuse audit events.
    """

    def dependency(
        conn: Connection = Depends(get_db),
        context: AuthorizationContext = Depends(get_authorization_context),
    ) -> AuthorizationContext:
        if not context.has_permission(permission):
            log_event(
                conn,
                user_id=context.user_id,
                action="UNAUTHORIZED_ACCESS_ATTEMPT",
                metadata={"permission": permission},
            )
            conn.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return context

    return dependency


class _UnconfiguredAIService(AIService):
    """
    Used when no AI provider is configured (AI_API_KEY unset). Lets the
    rest of the app - and its test suite - run with no key at all; a chat
    request fails with a clear, specific error instead of a crash.
    """

    def generate_response(self, **_kwargs: object) -> str:
        raise AIProviderNotConfigured("The AI assistant is not configured on this server yet")


def get_ai_service() -> AIService:
    """
    The single place the concrete AIService implementation is chosen.
    Routes/services depend on this, never on a provider class directly -
    tests override it with app.dependency_overrides[get_ai_service].
    """
    settings = get_settings()
    if not settings.ai_api_key:
        return _UnconfiguredAIService()
    if settings.ai_provider == "anthropic":
        return AnthropicAIService(api_key=settings.ai_api_key, model=settings.ai_model)
    raise RuntimeError(f"Unsupported AI_PROVIDER: {settings.ai_provider!r}")


def get_email_service() -> EmailService:
    """The single place the concrete EmailService implementation is chosen."""
    return ConsoleEmailService()
