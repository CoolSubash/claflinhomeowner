"""
Authorization tests: RBAC (roles/permissions) + resource ownership + IDOR.

These exercise the service/dependency layer directly against a real
database rather than going through HTTP routes, because this phase
deliberately does not add any business-feature endpoints (assessments,
chat, files, etc. - see claudeprompt/RBAC + Authorization.md, "No business
logic yet"). `require_permission`'s dependency function is a plain
callable, so it's invoked here the same way FastAPI would inject it, just
with explicit keyword arguments instead of DI.

Inactive-user denial is covered at the HTTP layer by
test_auth.py::test_me_inactive_user_rejected - `get_authorization_context`
sits strictly downstream of `get_current_user`, so it inherits that
guarantee and isn't re-tested here.
"""
import os
import uuid
from collections.abc import Sequence

import pytest
from fastapi import HTTPException

from app.api.deps import require_permission
from app.db.connection import get_connection
from app.schemas.authorization import AuthorizationContext
from app.services import ownership
from app.services.authorization import get_user_roles_and_permissions

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; requires a running PostgreSQL instance",
)

USER_PERMISSIONS = {
    "assessment:create",
    "assessment:read:own",
    "assessment:update:own",
    "chat:create",
    "chat:read:own",
    "file:create",
    "file:read:own",
    "file:delete:own",
    "connection:create",
    "testimonial:create",
}

REALTOR_PERMISSIONS = {"testimonial:create", "connection:respond:own"}

ADMIN_PERMISSIONS = {
    "assessment:read:any",
    "user:read:any",
    "audit:read",
    "scoring:update",
    "partner:manage",
}


def _unique_email() -> str:
    return f"authz_{uuid.uuid4().hex}@example.com"


def _create_user(conn, *, roles: Sequence[str] = ("USER",), is_active: bool = True) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (email, password_hash, first_name, last_name, is_active)
            VALUES (%s, 'x', 'Test', 'User', %s)
            RETURNING id
            """,
            (_unique_email(), is_active),
        )
        (user_id,) = cur.fetchone()
        for role_name in roles:
            cur.execute(
                "INSERT INTO user_roles (user_id, role_id) SELECT %s, id FROM roles WHERE name = %s",
                (user_id, role_name),
            )
    return user_id


def _cleanup_user(conn, user_id) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))


def _context_for(conn, user_id: uuid.UUID, *, is_active: bool = True) -> AuthorizationContext:
    roles, permissions = get_user_roles_and_permissions(conn, user_id)
    return AuthorizationContext(user_id=user_id, is_active=is_active, roles=roles, permissions=permissions)


# --- Permission tests (RBAC) ----------------------------------------------


def test_user_role_has_expected_permissions() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"USER"}
    assert permissions == USER_PERMISSIONS


def test_admin_role_has_expected_permissions() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["ADMIN"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"ADMIN"}
    assert permissions == ADMIN_PERMISSIONS


def test_support_role_has_only_expected_permissions() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["SUPPORT"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"SUPPORT"}
    assert permissions == {"user:read:any"}
    assert "scoring:update" not in permissions
    assert "partner:manage" not in permissions
    assert "assessment:read:any" not in permissions


def test_realtor_role_has_only_testimonial_create_and_connection_respond() -> None:
    # REALTOR can submit a testimonial about the platform (same as USER)
    # and respond to connection requests addressed to its linked partner
    # record - nothing else (see docs/authorization.md and
    # docs/realtor-onboarding.md).
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["REALTOR"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"REALTOR"}
    assert permissions == REALTOR_PERMISSIONS


def test_require_permission_denies_missing_permission() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            context = _context_for(conn, user_id)
            dependency = require_permission("user:read:any")
            with pytest.raises(HTTPException) as exc_info:
                dependency(conn=conn, context=context)
            assert exc_info.value.status_code == 403
        finally:
            _cleanup_user(conn, user_id)


def test_require_permission_allows_granted_permission() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            context = _context_for(conn, user_id)
            dependency = require_permission("assessment:create")
            result = dependency(conn=conn, context=context)
            assert result is context
        finally:
            _cleanup_user(conn, user_id)


def test_require_permission_unknown_permission_always_denied() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["ADMIN"])
        try:
            context = _context_for(conn, user_id)
            with pytest.raises(HTTPException) as exc_info:
                require_permission("not:a:real:permission")(conn=conn, context=context)
            assert exc_info.value.status_code == 403
        finally:
            _cleanup_user(conn, user_id)


def test_require_permission_denial_message_is_generic() -> None:
    # Never leak which permission/resource was involved (CLAUDE.md section 28).
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            context = _context_for(conn, user_id)
            with pytest.raises(HTTPException) as exc_info:
                require_permission("scoring:update")(conn=conn, context=context)
            assert exc_info.value.detail == "You do not have permission to perform this action"
        finally:
            _cleanup_user(conn, user_id)


def test_require_permission_denial_creates_audit_log() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            context = _context_for(conn, user_id)
            with pytest.raises(HTTPException):
                require_permission("scoring:update")(conn=conn, context=context)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT metadata FROM audit_logs WHERE user_id = %s AND action = 'UNAUTHORIZED_ACCESS_ATTEMPT'",
                    (user_id,),
                )
                row = cur.fetchone()
            assert row is not None
            assert row[0]["permission"] == "scoring:update"
        finally:
            _cleanup_user(conn, user_id)


# --- Admin tests ------------------------------------------------------------


def test_plain_user_denied_admin_only_permission() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER"])
        try:
            context = _context_for(conn, user_id)
            with pytest.raises(HTTPException) as exc_info:
                require_permission("user:read:any")(conn=conn, context=context)
            assert exc_info.value.status_code == 403
        finally:
            _cleanup_user(conn, user_id)


def test_admin_allowed_authorized_admin_permission() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["ADMIN"])
        try:
            context = _context_for(conn, user_id)
            result = require_permission("user:read:any")(conn=conn, context=context)
            assert result is context
        finally:
            _cleanup_user(conn, user_id)


def test_admin_does_not_bypass_permission_it_lacks() -> None:
    # ADMIN must not be treated as "allow everything" - it only has the
    # permissions explicitly granted to it (CLAUDE.md section 8/RBAC-spec).
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["ADMIN"])
        try:
            context = _context_for(conn, user_id)
            with pytest.raises(HTTPException) as exc_info:
                require_permission("assessment:create")(conn=conn, context=context)
            assert exc_info.value.status_code == 403
        finally:
            _cleanup_user(conn, user_id)


# --- Multiple-role tests -----------------------------------------------------


def test_multiple_roles_effective_permissions_are_union() -> None:
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER", "SUPPORT"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"USER", "SUPPORT"}
    assert "assessment:create" in permissions  # from USER
    assert "user:read:any" in permissions  # from SUPPORT
    assert "scoring:update" not in permissions  # granted by neither role
    assert permissions == USER_PERMISSIONS | {"user:read:any"}


def test_user_and_realtor_roles_union_adds_connection_respond_own() -> None:
    # A USER account that's also been onboarded as a REALTOR (the normal
    # outcome of realtor onboarding, docs/realtor-onboarding.md) gets the
    # union of both roles' permissions.
    with get_connection() as conn:
        user_id = _create_user(conn, roles=["USER", "REALTOR"])
        try:
            roles, permissions = get_user_roles_and_permissions(conn, user_id)
        finally:
            _cleanup_user(conn, user_id)
    assert roles == {"USER", "REALTOR"}
    assert permissions == USER_PERMISSIONS | {"connection:respond:own"}


# --- Ownership + IDOR tests --------------------------------------------------


@pytest.fixture
def resource_pair():
    """Two users, each with one of every ownership-checked resource type."""
    with get_connection() as conn:
        user_a = _create_user(conn, roles=["USER"])
        user_b = _create_user(conn, roles=["USER"])

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scoring_versions (version, weights, thresholds, is_active)
                VALUES (%s, '{}'::jsonb, '{}'::jsonb, false)
                RETURNING id
                """,
                (f"test-{uuid.uuid4().hex[:8]}",),
            )
            (scoring_version_id,) = cur.fetchone()

            cur.execute(
                """
                INSERT INTO real_estate_partners (name, contact_email)
                VALUES ('Test Partner', 'partner@example.com')
                RETURNING id
                """
            )
            (partner_id,) = cur.fetchone()

        def _make_resources(user_id: uuid.UUID) -> dict:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO assessments (user_id, status, income) VALUES (%s, 'DRAFT', 50000) RETURNING id",
                    (user_id,),
                )
                (assessment_id,) = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO readiness_results (assessment_id, user_id, scoring_version_id, overall_score, status)
                    VALUES (%s, %s, %s, 70, 'ALMOST_READY')
                    RETURNING id
                    """,
                    (assessment_id, user_id, scoring_version_id),
                )
                (result_id,) = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO score_breakdowns (readiness_result_id, user_id, category, raw_value, category_score, weight)
                    VALUES (%s, %s, 'credit', 700, 80, 0.150)
                    RETURNING id
                    """,
                    (result_id, user_id),
                )
                (breakdown_id,) = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO recommendations (readiness_result_id, user_id, category, priority, title, description)
                    VALUES (%s, %s, 'credit', 'HIGH', 'Improve credit', 'Pay down balances')
                    RETURNING id
                    """,
                    (result_id, user_id),
                )
                (recommendation_id,) = cur.fetchone()

                cur.execute(
                    "INSERT INTO chat_sessions (user_id, title, assessment_id) VALUES (%s, 'Session', %s) RETURNING id",
                    (user_id, assessment_id),
                )
                (session_id,) = cur.fetchone()

                cur.execute(
                    "INSERT INTO chat_messages (session_id, user_id, role, content) VALUES (%s, %s, 'USER', 'hello') RETURNING id",
                    (session_id, user_id),
                )
                (message_id,) = cur.fetchone()

                cur.execute(
                    """
                    INSERT INTO files (user_id, assessment_id, original_filename, storage_key, content_type, file_size)
                    VALUES (%s, %s, 'doc.pdf', %s, 'application/pdf', 1024)
                    RETURNING id
                    """,
                    (user_id, assessment_id, f"users/{user_id}/files/{uuid.uuid4().hex}"),
                )
                (file_id,) = cur.fetchone()

                cur.execute(
                    "INSERT INTO connection_requests (user_id, partner_id, consent_given_at) VALUES (%s, %s, now()) RETURNING id",
                    (user_id, partner_id),
                )
                (connection_request_id,) = cur.fetchone()

            return {
                "assessment_id": assessment_id,
                "readiness_result_id": result_id,
                "score_breakdown_id": breakdown_id,
                "recommendation_id": recommendation_id,
                "chat_session_id": session_id,
                "chat_message_id": message_id,
                "file_id": file_id,
                "connection_request_id": connection_request_id,
            }

        resources_a = _make_resources(user_a)
        resources_b = _make_resources(user_b)

        yield {
            "conn": conn,
            "user_a": user_a,
            "user_b": user_b,
            "a": resources_a,
            "b": resources_b,
        }

        _cleanup_user(conn, user_a)
        _cleanup_user(conn, user_b)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM real_estate_partners WHERE id = %s", (partner_id,))
            cur.execute("DELETE FROM scoring_versions WHERE id = %s", (scoring_version_id,))


def test_assessment_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_assessment(conn, a["assessment_id"], user_a) is not None
    assert ownership.get_owned_assessment(conn, a["assessment_id"], user_b) is None


def test_file_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_file(conn, a["file_id"], user_a) is not None
    assert ownership.get_owned_file(conn, a["file_id"], user_b) is None


def test_chat_session_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_chat_session(conn, a["chat_session_id"], user_a) is not None
    assert ownership.get_owned_chat_session(conn, a["chat_session_id"], user_b) is None


def test_chat_messages_ownership_resolved_via_session(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    messages = ownership.list_owned_chat_messages(conn, a["chat_session_id"], user_a)
    assert messages is not None
    assert len(messages) == 1
    assert messages[0]["id"] == a["chat_message_id"]
    # A client-supplied session_id must not grant access to another user's messages.
    assert ownership.list_owned_chat_messages(conn, a["chat_session_id"], user_b) is None


def test_readiness_result_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_readiness_result(conn, a["readiness_result_id"], user_a) is not None
    assert ownership.get_owned_readiness_result(conn, a["readiness_result_id"], user_b) is None


def test_score_breakdown_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_score_breakdown(conn, a["score_breakdown_id"], user_a) is not None
    assert ownership.get_owned_score_breakdown(conn, a["score_breakdown_id"], user_b) is None


def test_recommendation_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_recommendation(conn, a["recommendation_id"], user_a) is not None
    assert ownership.get_owned_recommendation(conn, a["recommendation_id"], user_b) is None


def test_connection_request_ownership(resource_pair) -> None:
    conn, user_a, user_b, a = resource_pair["conn"], resource_pair["user_a"], resource_pair["user_b"], resource_pair["a"]
    assert ownership.get_owned_connection_request(conn, a["connection_request_id"], user_a) is not None
    assert ownership.get_owned_connection_request(conn, a["connection_request_id"], user_b) is None


def test_idor_user_a_cannot_access_user_b_resources_by_swapping_ids(resource_pair) -> None:
    """
    Simulates the classic IDOR attack: User A, who legitimately owns their
    own resources, edits the URL/ID to point at User B's resource instead.
    Every one of these must resolve to "not found", never User B's data.
    """
    conn, user_a, b = resource_pair["conn"], resource_pair["user_a"], resource_pair["b"]

    assert ownership.get_owned_assessment(conn, b["assessment_id"], user_a) is None
    assert ownership.get_owned_file(conn, b["file_id"], user_a) is None
    assert ownership.get_owned_chat_session(conn, b["chat_session_id"], user_a) is None
    assert ownership.list_owned_chat_messages(conn, b["chat_session_id"], user_a) is None
    assert ownership.get_owned_readiness_result(conn, b["readiness_result_id"], user_a) is None
    assert ownership.get_owned_score_breakdown(conn, b["score_breakdown_id"], user_a) is None
    assert ownership.get_owned_recommendation(conn, b["recommendation_id"], user_a) is None
    assert ownership.get_owned_connection_request(conn, b["connection_request_id"], user_a) is None


def test_assessment_read_any_ignores_ownership_for_admin_path(resource_pair) -> None:
    # get_assessment_by_id has no ownership filter - it's only safe to call
    # once the caller has already been confirmed to hold assessment:read:any
    # via require_permission. Confirm it can see either user's assessment.
    conn, a, b = resource_pair["conn"], resource_pair["a"], resource_pair["b"]
    assert ownership.get_assessment_by_id(conn, a["assessment_id"]) is not None
    assert ownership.get_assessment_by_id(conn, b["assessment_id"]) is not None


def test_nonexistent_resource_id_returns_none_not_error(resource_pair) -> None:
    conn, user_a = resource_pair["conn"], resource_pair["user_a"]
    assert ownership.get_owned_assessment(conn, uuid.uuid4(), user_a) is None
