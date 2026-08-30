from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.security import get_password_hash
from app.models.auth import User, Role, UserRole, Permission, RolePermission
from app.models.operations import Notification
from app.services.notifications import create_notification
from app.api.deps import get_current_user_dict
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


router = APIRouter(prefix="/admin/users", tags=["admin-users"])


# Schemas
class UserResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_verified: bool
    roles: List[str] = []
    created_at: Optional[datetime] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: str
    roles: List[str] = []


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    roles: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class PermissionResponse(BaseModel):
    id: int
    name: str
    resource: str
    action: str
    description: Optional[str] = None


def _user_response(db: Session, user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        roles=[r.name for r in user.roles],
        created_at=user.created_at,
    )


def _require_admin(current_user: dict):
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    role = current_user.get("role", "") or ""
    roles = [r.lower() for r in current_user.get("roles", [])]
    if role.lower() not in ("admin", "super admin", "super_admin") and "admin" not in roles and "super admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    users = db.query(User).all()
    return [_user_response(db, u) for u in users]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        is_verified=True,
    )
    db.add(user)
    db.flush()
    role_names = data.roles or ["User"]
    for name in role_names:
        role = db.query(Role).filter(Role.name == name).first()
        if role:
            user.roles.append(role)
    create_notification(
        db, user_id=user.id, title="Account Created",
        body="An admin created your account.", notification_type="SECURITY",
    )
    db.commit()
    db.refresh(user)
    return _user_response(db, user)


@router.get("/{user_id:int}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _user_response(db, user)


@router.patch("/{user_id:int}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.phone is not None:
        user.phone = data.phone
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_verified is not None:
        user.is_verified = data.is_verified
    if data.roles is not None:
        user.roles = []
        for name in data.roles:
            role = db.query(Role).filter(Role.name == name).first()
            if role:
                user.roles.append(role)
    db.commit()
    db.refresh(user)
    return _user_response(db, user)


# ---- Roles ----

@router.get("/roles/all", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    roles = db.query(Role).all()
    return [
        RoleResponse(
            id=r.id, name=r.name, description=r.description,
            permissions=[f"{p.resource}:{p.action}" for p in r.permissions],
        )
        for r in roles
    ]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    if db.query(Role).filter(Role.name == data.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already exists")
    role = Role(name=data.name, description=data.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return RoleResponse(id=role.id, name=role.name, description=role.description, permissions=[])


@router.patch("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if data.description is not None:
        role.description = data.description
    if data.permissions is not None:
        perms = []
        for key in data.permissions:
            resource, _, action = key.partition(":")
            if not action:
                continue
            perm = db.query(Permission).filter(
                Permission.resource == resource, Permission.action == action).first()
            if perm:
                perms.append(perm)
        role.permissions = perms
    db.commit()
    db.refresh(role)
    return RoleResponse(id=role.id, name=role.name, description=role.description,
                        permissions=[f"{p.resource}:{p.action}" for p in role.permissions])


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    role = db.query(Role).get(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.name in ("Super Admin", "Admin"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Built-in roles cannot be deleted")
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete role assigned to {len(role.users)} user(s)",
        )
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    db.delete(role)
    db.commit()
    return None


@router.get("/permissions", response_model=List[PermissionResponse])
def list_permissions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    _require_admin(current_user)
    perms = db.query(Permission).all()
    return [PermissionResponse(id=p.id, name=p.name, resource=p.resource, action=p.action, description=p.description) for p in perms]
