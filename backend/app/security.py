from jose import JWTError, jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.core.config import settings
import bcrypt
import secrets
import hashlib


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash using bcrypt directly.

    Compatible with existing bcrypt hashes ($2b$ prefix) created by either
    passlib or the direct bcrypt helper functions.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate a bcrypt password hash using bcrypt directly."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password_direct(plain_password: str, hashed_password: str) -> bool:
    """Direct bcrypt verification without passlib overhead."""
    return verify_password(plain_password, hashed_password)


def get_password_hash_direct(password: str) -> str:
    """Generate password hash using bcrypt directly."""
    return get_password_hash(password)


def _refresh_secret() -> str:
    """Refresh-token signing secret (spec §57 / §69: separate JWT_REFRESH_SECRET)."""
    return settings.jwt_refresh_secret or settings.secret_key


def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode = {
        "exp": expire,
        "sub": subject,
        "iat": datetime.utcnow(),
        "type": "access",
        "jti": secrets.token_hex(16),
    }
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(subject: str) -> str:
    """Create a JWT refresh token signed with the dedicated refresh secret."""
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode = {
        "exp": expire,
        "sub": subject,
        "iat": datetime.utcnow(),
        "type": "refresh",
        "jti": secrets.token_hex(16),
    }
    encoded_jwt = jwt.encode(to_encode, _refresh_secret(), algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str, expected_type: str = None) -> dict:
    """Decode and validate a JWT token.

    Access tokens are verified with the main secret; refresh tokens with the
    dedicated refresh secret. Token `type` claims are enforced when expected_type
    is provided so access tokens can never be used as refresh tokens and vice versa.
    """
    payload = None
    for secret in (settings.secret_key, _refresh_secret()):
        try:
            candidate = jwt.decode(token, secret, algorithms=[settings.algorithm])
            payload = candidate
            break
        except JWTError:
            continue
    if payload is None:
        return None

    if expected_type and payload.get("type") != expected_type:
        return None
    return payload


def hash_value(value: str) -> str:
    """SHA-256 hash used to store refresh tokens / reset tokens at rest."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def create_password_reset_token() -> str:
    """Generate a high-entropy password-reset token (spec §57)."""
    return secrets.token_urlsafe(48)


def hash_password_reset_token(token: str) -> str:
    """Hash a reset token before storing against the user record."""
    return hashlib.sha256(("prt:" + token).encode("utf-8")).hexdigest()


def get_current_user(token: str, db: Session) -> dict:
    """Get current user from JWT token (dict carrier used by legacy modules)."""
    payload = decode_token(token, expected_type="access")
    if payload is None:
        return None

    sub: str = payload.get("sub")
    if sub is None:
        return None

    from app.models.auth import User
    user = db.query(User).filter(User.id == int(sub)).first() if sub.isdigit() else None
    if not user or not user.is_active:
        return None

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "role": user.roles[0].name if user.roles else "user",
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "iat": payload.get("iat"),
        "exp": payload.get("exp"),
    }


def get_current_active_user(current_user: dict = None) -> dict:
    """Dependency to get current active user from a dict carrier."""
    if current_user is None:
        return None
    if not current_user.get("id"):
        return None
    if not current_user.get("is_active", True):
        return None
    return current_user


def is_token_expired(payload: dict) -> bool:
    """Check if token is expired."""
    exp: float = payload.get("exp", 0)
    return datetime.utcnow() > datetime.fromtimestamp(exp)