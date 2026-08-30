from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.auth import User, Role, Permission, UserRole, RolePermission


def get_current_user_dependency(
    db: Session = Depends(get_db),
    token: str = Depends(None),  # will be replaced with actual token dependency
) -> dict:
    """Get current authenticated user from JWT token."""
    # This will be integrated with the token auth dependency
    # For now, return structure for dependency chaining
    return {"id": None, "email": "", "role": "guest", "permissions": []}


def check_role(current_user: dict, required_role: str) -> dict:
    """Dependency helper to check if user has required role."""
    if not current_user or not current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required role: {required_role}"
        )
    if current_user.get("role") != required_role and required_role not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required role: {required_role}"
        )
    return current_user


def check_permission(current_user: dict, resource: str, action: str) -> dict:
    """Dependency helper to check if user has required permission."""
    if not current_user or not current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required permission: {resource}:{action}"
        )
    # Check permissions - simplified for dependency chain
    user_permissions = current_user.get("permissions", [])
    if f"{resource}:{action}" not in user_permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Required permission: {resource}:{action}"
        )
    return current_user


def rbac_dependency(
    db: Session = Depends(get_db),
    current_user: dict = Depends(lambda: {"id": None}),
) -> dict:
    """Centralized RBAC dependency.
    
    Returns the authenticated user with role and permission info.
    Raises 401 if not authenticated, 403 if authorization fails.
    """
    if not current_user or not current_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return current_user