"""Shared FastAPI dependencies: real JWT auth, RBAC role checks and feature flags.

These replace the placeholder `Depends(lambda: {"id": 1})` dependency used by
earlier phase routers and provide consistent, testable authorization for all
Phase 3 / Phase 4 endpoints.
"""
import time
from threading import Lock
from fastapi import Depends, Request, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.core.config import settings
from app.models.auth import User, Role, Permission, UserRole, RolePermission
from app.models.operations import FeatureFlag
from app.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticating user from the JWT bearer token.

    Requires a valid, non-expired access token. Returns the live ORM User so
    role/permission checks have access to real database state.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # sub is the stringified user id produced by create_access_token()
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return user


def require_roles(*roles: str):
    """Dependency factory: require the user to hold at least one of the roles."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {r.name for r in current_user.roles}
        if not (user_roles & set(roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role(s): {', '.join(roles)}",
            )
        return current_user
    return _checker


def require_permission(resource: str, action: str):
    """Dependency factory: require the user to hold `resource:action`."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_perms = {f"{p.resource}:{p.action}" for p in current_user.permissions}
        if f"{resource}:{action}" not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required permission: {resource}:{action}",
            )
        return current_user
    return _checker


def require_feature(feature_key: str, *roles: str):
    """Dependency factory: 403 when the feature flag is missing/disabled.

    Enforces feature flags server-side (spec §47). Flags are configured by
    admins through the feature-flags endpoints and seeded as enabled by default.

    Optional role names restrict the flag to specific roles (spec §58) — without
    them any authenticated staff user may use the enabled feature, so Finance /
    Support / Developer roles are not blocked from modules the spec assigns them.
    """
    def _checker(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        flag = db.query(FeatureFlag).filter(FeatureFlag.key == feature_key).first()
        if flag is None or not flag.is_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_key}' is disabled",
            )
        if roles:
            user_roles = {r.name for r in current_user.roles}
            if not (user_roles & set(roles)):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Required role(s): {', '.join(roles)}",
                )
        return current_user
    return _checker


def get_current_user_dict(current_user: User = Depends(get_current_user)) -> dict:
    """Real authenticated user as a dict carrier.

    Replacement for the `Depends(lambda: {"id": 1})` placeholders used by the
    earlier phase routers — always resolves the actual JWT bearer user.
    """
    return serialize_user(current_user)


# ---------------------------------------------------------------------------
# Public-form rate limiting (spec §60)
# ---------------------------------------------------------------------------

_rate_buckets = {}
_rate_lock = Lock()


def rate_limit():
    """Per-IP sliding-window limiter for public forms."""
    def _checker(request: Request):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = settings.rate_limit_window_seconds
        max_req = settings.rate_limit_max_requests
        with _rate_lock:
            bucket = [t for t in _rate_buckets.get(ip, []) if now - t < window]
            if len(bucket) >= max_req:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                )
            bucket.append(now)
            _rate_buckets[ip] = bucket
        return request
    return _checker


def serialize_user(user: User) -> dict:
    """Build the token/user dict shape used by the rest of the app."""
    roles = [r.name for r in user.roles]
    permissions = sorted({f"{p.resource}:{p.action}" for p in user.permissions})
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "role": roles[0] if roles else "user",
        "roles": roles,
        "permissions": permissions,
    }