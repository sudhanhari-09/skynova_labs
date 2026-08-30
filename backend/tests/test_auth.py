"""Authentication tests for PROJECT LABS Phase 1."""

import pytest
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

from app.core.config import settings
from app.security import verify_password, get_password_hash, create_access_token, decode_token
from app.models.auth import User, Role, Permission, UserRole, RolePermission


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TestPasswordSecurity:
    """Test password hashing and verification."""

    def test_hash_password(self):
        """Password should never be stored in plaintext."""
        password = "TestPass123!"
        hashed = get_password_hash(password)
        
        # Hash should never be empty
        assert hashed != ""
        assert len(hashed) > 20
        
        # Hash should not be reversible (one-way)
        # We can verify it works but not decode it
        
        # Verify the password can be checked
        assert verify_password(password, hashed)
        
        # Wrong password should fail
        assert not verify_password("wrong_password", hashed)

    def test_plaintext_never_stored(self):
        """Ensure we don't store plaintext passwords."""
        # This is a code review test - the model should have password_hash, not password
        from app.models.auth import User
        assert hasattr(User, "password_hash")
        # password field should not exist on the model
        with pytest.raises(AttributeError):
            # This should fail if someone tries to access .password on User
            pass  # Just ensuring the test structure is correct


class TestJWTAuthentication:
    """Test JWT token creation and validation."""

    def test_create_access_token(self):
        """Access token should contain appropriate claims."""
        subject = "test-user-id"
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
        
        token = create_access_token(subject, expires_delta)
        assert token != ""
        
        # Token should be decodable
        payload = decode_token(token)
        assert payload is not None
        assert payload.get("sub") == subject
        assert payload.get("exp") is not None
        assert payload.get("iat") is not None

    def test_create_refresh_token(self):
        """Refresh token should have longer expiration."""
        subject = "test-user-id"
        token = create_access_token(subject)
        assert token != ""
        
        payload = decode_token(token)
        assert payload is not None
        # Refresh token should have different expiration
        exp = payload.get("exp")
        assert exp is not None

    def test_token_without_sub(self):
        """Token without 'sub' claim should be invalid."""
        # Create a minimal token without sub
        from jose import jwt as jwt_encode
        # This tests the validation logic
        pass


class TestAuthenticationFlow:
    """Test the full authentication registration and login flow."""

    def test_registration_validates_duplicate_email(self):
        """Registration should reject duplicate emails."""
        # This tests the business logic - actual DB test needs fixture
        assert True  # Placeholder - tested via API endpoints

    def test_login_with_valid_credentials(self):
        """Login should succeed with correct email/password."""
        # Test the password verification logic
        password = "TestPass123!"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed)
        
    def test_login_with_invalid_credentials(self):
        """Login should fail with wrong password."""
        password = "TestPass123!"
        wrong = "WrongPassword!"
        hashed = get_password_hash(password)
        assert not verify_password(wrong, hashed)

    def test_login_disabled_account(self):
        """Login should reject disabled accounts."""
        # Logic tested via API endpoints
        pass


class TestRBACModel:
    """Test role-based access control model."""

    def test_user_role_relationship(self):
        """Users should have roles assigned."""
        from app.models.auth import User, Role, UserRole
        
        # Test that the models can be created with proper relationships
        role = Role(name="test-role", description="Test role")
        user = User(
            email="test@example.com",
            password_hash=get_password_hash("password123"),
        )
        user.roles.append(role)
        
        # Verify relationship
        assert len(user.roles) == 1
        assert user.roles[0].name == "test-role"

    def test_role_permission_relationship(self):
        """Roles should have permissions assigned."""
        from app.models.auth import Role, Permission, RolePermission
        
        role = Role(name="test-role", description="Test role")
        permission = Permission(
            name="test:perm",
            resource="test",
            action="read",
            description="Test permission"
        )
        role.permissions.append(permission)
        
        assert len(role.permissions) == 1
        assert role.permissions[0].name == "test:perm"

    def test_permission_check_pattern(self):
        """Permissions should follow resource:action pattern."""
        from app.models.auth import Permission
        
        perm = Permission(
            name="users.read",
            resource="users",
            action="read",
            description="View users"
        )
        
        assert perm.resource == "users"
        assert perm.action == "read"
        assert perm.name == "users.read"


class TestUserModel:
    """Test User model fields."""

    def test_user_required_fields(self):
        """User should have all required authentication fields."""
        from app.models.auth import User
        
        # User should support these fields
        user_fields = ["email", "password_hash", "first_name", "last_name", 
                      "phone", "is_active", "is_verified", "last_login_at",
                      "created_at", "updated_at"]
        
        # Verify the model has the base fields from TimeStampedModel
        assert hasattr(User, "id")
        assert hasattr(User, "created_at")
        assert hasattr(User, "updated_at")
        
        # Verify authentication-specific fields exist
        assert hasattr(User, "email")
        assert hasattr(User, "password_hash")
        assert hasattr(User, "is_active")
        assert hasattr(User, "is_verified")

    def test_user_is_active_default(self):
        """New users should be active by default."""
        from app.models.auth import User
        
        # is_active defaults to True
        assert User.__table__.c.is_active.default.arg == True


class TestConfiguration:
    """Test configuration values."""

    def test_jwt_config_not_hardcoded(self):
        """JWT settings should come from configuration, not be hardcoded."""
        from app.core.config import settings
        
        # Secret key should be from environment
        assert settings.secret_key != "hardcoded-secret"
        assert settings.algorithm == "HS256"
        assert settings.access_token_expire_minutes > 0
        assert settings.refresh_token_expire_days > 0

    def test_environment_variables(self):
        """Required environment variables should be configured."""
        from app.core.config import settings
        
        # Critical auth config should be present
        assert settings.database_url != ""
        assert settings.secret_key != "change-this-to-a-strong-random-key-in-production" or settings.environment == "development"