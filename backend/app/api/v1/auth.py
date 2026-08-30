from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.db import get_db
from app.core.config import settings
from app.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_value,
    hash_password_reset_token,
    create_password_reset_token,
)
from app.api.deps import get_current_user as current_user_dep
from app.models.auth import User, Role, UserRole, Permission, RolePermission
from app.models.operations import Notification
from app.models.spec import TokenSession, LoginAttempt
from app.services.notifications import create_notification
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta, datetime, timezone


router = APIRouter(prefix="/auth", tags=["auth"])


# Pydantic schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserInfo(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_verified: bool
    role: str
    roles: list = []
    permissions: list = []


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


def _create_token_session(db: Session, user_id: int, refresh_token: str, request: Request = None):
    """Register a server-side refresh-token session for revocation support."""
    payload = decode_token(refresh_token, expected_type="refresh")
    jti = payload.get("jti") if payload else None
    exp = payload.get("exp") if payload else (datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days))
    session = TokenSession(
        user_id=user_id,
        refresh_token_hash=hash_value(refresh_token),
        jti=jti,
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None)
        if isinstance(exp, (int, float)) else exp,
        created_ip=request.client.host if request and request.client else None,
    )
    db.add(session)
    return session


def _revoke_refresh_session(db: Session, refresh_token: str):
    session = db.query(TokenSession).filter(
        TokenSession.refresh_token_hash == hash_value(refresh_token)
    ).first()
    if session:
        session.revoked = True
        session.revoked_at = datetime.utcnow()
    return session


def _revoke_all_user_sessions(db: Session, user_id: int):
    db.query(TokenSession).filter(TokenSession.user_id == user_id, TokenSession.revoked == False).update(
        {TokenSession.revoked: True, TokenSession.revoked_at: datetime.utcnow()},
        synchronize_session=False,
    )


def _issue_tokens(db: Session, user: User, request: Request = None) -> TokenResponse:
    """Issue an access + refresh token pair and register the refresh session."""
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    refresh_token = create_refresh_token(subject=str(user.id))
    _create_token_session(db, user.id, refresh_token, request)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Register a new user with automatic 'User' role assignment."""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    password_hash = get_password_hash(user_data.password)

    user_role = db.query(Role).filter(Role.name == "User").first()
    if not user_role:
        user_role = Role(name="User", description="Standard user role")
        db.add(user_role)
        db.flush()

    new_user = User(
        email=user_data.email,
        password_hash=password_hash,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
    )
    new_user.roles.append(user_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    res = _issue_tokens(db, new_user, request)
    db.commit()
    return res


@router.post("/login", response_model=TokenResponse)
async def login(
    user_data: UserLogin,
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Login with email + password (with attempt lockout, spec §57)."""
    ip = request.client.host if request and request.client else None
    user = db.query(User).filter(User.email == user_data.email).first()

    _record_attempt = lambda success: db.add(LoginAttempt(
        email=user_data.email,
        successful=success,
        ip_address=ip,
        attempted_at=datetime.utcnow(),
    ))

    if not user:
        _record_attempt(False)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account temporarily locked. Try again in {remaining} minute(s).",
        )

    if not verify_password(user_data.password, user.password_hash):
        user.login_attempt_count = (user.login_attempt_count or 0) + 1
        if user.login_attempt_count >= settings.max_login_attempts:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.login_lockout_minutes)
            user.login_attempt_count = 0
        _record_attempt(False)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lockout cleared; record success
    user.login_attempt_count = 0
    user.locked_until = None
    user.is_verified = True
    user.last_login_at = datetime.utcnow()
    _record_attempt(True)
    db.commit()

    res = _issue_tokens(db, user, request)
    db.commit()
    return res


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Refresh access token. Rotation: the presented session is revoked and a
    fresh pair is issued; a previously revoked/reused token is rejected."""
    payload = decode_token(refresh_token_data.refresh_token, expected_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    sub = payload.get("sub")
    if sub is None or not str(sub).isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    session = db.query(TokenSession).filter(
        TokenSession.refresh_token_hash == hash_value(refresh_token_data.refresh_token)
    ).first()

    if session is None or session.revoked:
        # Reuse or foreign token: revoke any matching session to neutralize
        # a stolen token, then reject.
        if session is not None:
            session.revoked = True
            session.revoked_at = datetime.utcnow()
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    if session.expires_at and session.expires_at < datetime.utcnow():
        session.revoked = True
        session.revoked_at = datetime.utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    user = db.query(User).filter(User.id == int(sub)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    # Rotate: revoke the presented session and issue a fresh pair.
    session.revoked = True
    session.revoked_at = datetime.utcnow()

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    new_refresh_token = create_refresh_token(subject=str(user.id))
    _create_token_session(db, user.id, new_refresh_token)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout")
async def logout(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(current_user_dep),
):
    """Revoke the server-side refresh session so tokens cannot be reused."""
    _revoke_refresh_session(db, payload.refresh_token)
    db.commit()
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserInfo)
async def get_me(
    current_user: User = Depends(current_user_dep),
):
    """Get current authenticated user info (spec §57 - fixed /me)."""
    roles = sorted({r.name for r in current_user.roles})
    permissions = sorted({f"{p.resource}:{p.action}" for p in current_user.permissions})
    return UserInfo(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        role=roles[0] if roles else "user",
        roles=roles,
        permissions=permissions,
    )


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(current_user_dep),
):
    """Change the authenticated user's password (revokes all sessions)."""
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    current_user.password_hash = get_password_hash(data.new_password)
    _revoke_all_user_sessions(db, current_user.id)
    create_notification(
        db,
        user_id=current_user.id,
        title="Password Changed",
        body="Your password was changed successfully.",
        notification_type="SECURITY",
    )
    db.commit()
    return {"detail": "Password updated successfully"}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Generate a single-use, hashed password-reset token (spec §57)."""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        # Do not reveal whether the email exists
        return {"detail": "If that email is registered, a reset link has been sent."}

    reset_token = create_password_reset_token()
    user.password_reset_token_hash = hash_password_reset_token(reset_token)
    user.password_reset_expires_at = datetime.utcnow() + timedelta(
        minutes=settings.password_reset_expire_minutes
    )
    db.commit()

    reset_link = f"{settings.frontend_url}/reset-password?token={reset_token}"
    create_notification(
        db,
        user_id=user.id,
        title="Password Reset Requested",
        body=f"Use the link below to reset your password (valid for "
             f"{settings.password_reset_expire_minutes} minutes).\n{reset_link}",
        notification_type="SECURITY",
    )
    db.commit()
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Reset a password using the single-use token from forgot-password."""
    token_hash = hash_password_reset_token(data.token)
    user = db.query(User).filter(
        User.password_reset_token_hash == token_hash
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    if user.password_reset_expires_at and user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired",
        )

    user.password_hash = get_password_hash(data.new_password)
    # Single-use: invalidate the token and all existing sessions.
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.login_attempt_count = 0
    user.locked_until = None
    _revoke_all_user_sessions(db, user.id)
    create_notification(
        db,
        user_id=user.id,
        title="Password Reset",
        body="Your password was reset successfully.",
        notification_type="SECURITY",
    )
    db.commit()
    return {"detail": "Password reset successfully. You can now log in."}