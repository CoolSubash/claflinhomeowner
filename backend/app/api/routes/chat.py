from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection

from app.api.deps import get_ai_service, get_db, require_permission
from app.schemas.authorization import AuthorizationContext
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageExchange,
    ChatMessagePublic,
    ChatSessionCreate,
    ChatSessionPublic,
    ChatSessionWithMessages,
)
from app.services import chat as chat_service
from app.services.ai.base import AIProviderNotConfigured, AIService, AIServiceError
from app.services.audit import log_event
from app.services.rate_limit import RateLimitExceeded

router = APIRouter(prefix="/chat", tags=["chat"])


def _session_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")


@router.post("/sessions", response_model=ChatSessionPublic, status_code=status.HTTP_201_CREATED)
def create_session(
    data: ChatSessionCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("chat:create")),
) -> ChatSessionPublic:
    try:
        row = chat_service.create_session(
            conn, user_id=context.user_id, title=data.title, assessment_id=data.assessment_id
        )
    except chat_service.AssessmentNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found"
        ) from exc

    log_event(
        conn,
        user_id=context.user_id,
        action="CHAT_SESSION_CREATED",
        resource_type="chat_session",
        resource_id=row["id"],
    )
    return ChatSessionPublic(**row)


@router.get("/sessions", response_model=list[ChatSessionPublic])
def list_sessions(
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("chat:read:own")),
) -> list[ChatSessionPublic]:
    rows = chat_service.list_sessions(conn, user_id=context.user_id)
    return [ChatSessionPublic(**row) for row in rows]


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
def get_session(
    session_id: UUID,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("chat:read:own")),
) -> ChatSessionWithMessages:
    found = chat_service.get_session_with_messages(conn, session_id=session_id, user_id=context.user_id)
    if found is None:
        raise _session_not_found()
    session, messages = found

    log_event(
        conn,
        user_id=context.user_id,
        action="CHAT_SESSION_VIEWED",
        resource_type="chat_session",
        resource_id=session_id,
    )
    return ChatSessionWithMessages(
        **session, messages=[ChatMessagePublic(**m) for m in messages]
    )


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageExchange,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    session_id: UUID,
    data: ChatMessageCreate,
    conn: Connection = Depends(get_db),
    context: AuthorizationContext = Depends(require_permission("chat:create")),
    ai_service: AIService = Depends(get_ai_service),
) -> ChatMessageExchange:
    try:
        user_message, assistant_message = chat_service.send_message(
            conn,
            session_id=session_id,
            user_id=context.user_id,
            content=data.content,
            ai_service=ai_service,
        )
    except chat_service.SessionNotFound as exc:
        raise _session_not_found() from exc
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many chat messages - please try again later",
        ) from exc
    except AIProviderNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI assistant isn't configured on this server yet",
        ) from exc
    except AIServiceError as exc:
        # Never surface provider internals to the client (CLAUDE.md
        # section 28 / Phase 8 section 25) - the AnthropicAIService has
        # already logged the real cause.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sorry, I couldn't generate a response right now. Please try again.",
        ) from exc

    log_event(
        conn,
        user_id=context.user_id,
        action="CHAT_MESSAGE_SENT",
        resource_type="chat_session",
        resource_id=session_id,
    )
    log_event(
        conn,
        user_id=context.user_id,
        action="CHAT_MESSAGE_GENERATED",
        resource_type="chat_message",
        resource_id=assistant_message["id"],
    )
    return ChatMessageExchange(
        user_message=ChatMessagePublic(**user_message),
        assistant_message=ChatMessagePublic(**assistant_message),
    )
