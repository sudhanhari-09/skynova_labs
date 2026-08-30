"""Feature flags (Phase 3/4 control plane).

Every software module ships behind a flag so the platform can be progressively
enabled. Flags live in the DB so runtime toggles are immediate; every change is
audited. A public-safe endpoint exposes GLOBAL/PUBLIC flags to the frontend and
client portal without leaking internal configuration.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import FeatureFlag, FeatureFlagAuditLog


admin_router = APIRouter(prefix="/admin/feature-flags", tags=["admin-feature-flags"])
public_router = APIRouter(prefix="/public/config", tags=["public-config"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FlagCreate(BaseModel):
    key: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    description: Optional[str] = None
    is_enabled: bool = True
    scope: str = "ADMIN"  # ADMIN | GLOBAL | PUBLIC


class FlagUpdate(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    is_enabled: Optional[bool] = None
    scope: Optional[str] = None


class FlagResponse(BaseModel):
    id: int
    key: str
    label: str
    description: Optional[str] = None
    is_enabled: bool
    scope: str
    created_at: datetime
    updated_at: datetime


class AuditResponse(BaseModel):
    id: int
    flag_id: int
    flag_key: Optional[str] = None
    changed_by: Optional[int] = None
    field: str
    old_value: Optional[object] = None
    new_value: Optional[object] = None
    created_at: datetime


class PublicConfigResponse(BaseModel):
    flags: List[FlagResponse]


VALID_SCOPES = ["ADMIN", "GLOBAL", "PUBLIC"]


def write_audit(db: Session, flag: FeatureFlag, changed_by: int, field: str, old_value, new_value):
    db.add(FeatureFlagAuditLog(
        flag_id=flag.id,
        changed_by=changed_by,
        field=field,
        old_value=old_value,
        new_value=new_value,
    ))


def is_flag_enabled(db: Session, key: str) -> bool:
    flag = db.query(FeatureFlag).filter(FeatureFlag.key == key).first()
    return bool(flag and flag.is_enabled)


def build_flag_response(flag: FeatureFlag) -> FlagResponse:
    return FlagResponse(
        id=flag.id,
        key=flag.key,
        label=flag.label,
        description=flag.description,
        is_enabled=flag.is_enabled,
        scope=flag.scope,
        created_at=flag.created_at,
        updated_at=flag.updated_at,
    )


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

@admin_router.get("/", response_model=List[FlagResponse])
def list_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    flags = db.query(FeatureFlag).order_by(FeatureFlag.key.asc()).all()
    return [build_flag_response(f) for f in flags]


@admin_router.post("/", response_model=FlagResponse, status_code=status.HTTP_201_CREATED)
def create_flag(
    data: FlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    if data.scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {data.scope}")
    if db.query(FeatureFlag).filter(FeatureFlag.key == data.key).first():
        raise HTTPException(status_code=400, detail=f"Flag already exists: {data.key}")

    flag = FeatureFlag(
        key=data.key,
        label=data.label,
        description=data.description,
        is_enabled=data.is_enabled,
        scope=data.scope,
        created_by=current_user.id,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return build_flag_response(flag)


@admin_router.patch("/{flag_id}", response_model=FlagResponse)
def update_flag(
    flag_id: int,
    data: FlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    flag = db.query(FeatureFlag).get(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    update_data = data.model_dump(exclude_unset=True)
    if "scope" in update_data and update_data["scope"] not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {update_data['scope']}")

    for field, value in update_data.items():
        old_value = getattr(flag, field)
        if old_value != value:
            write_audit(db, flag, current_user.id, field, old_value, value)
            setattr(flag, field, value)
            flag.updated_by = current_user.id

    db.commit()
    db.refresh(flag)
    return build_flag_response(flag)


@admin_router.post("/{flag_id}/toggle", response_model=FlagResponse)
def toggle_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    flag = db.query(FeatureFlag).get(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    old_value = flag.is_enabled
    flag.is_enabled = not old_value
    flag.updated_by = current_user.id
    write_audit(db, flag, current_user.id, "is_enabled", old_value, flag.is_enabled)

    db.commit()
    db.refresh(flag)
    return build_flag_response(flag)


@admin_router.delete("/{flag_id}", status_code=200)
def delete_flag(
    flag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    flag = db.query(FeatureFlag).get(flag_id)
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    write_audit(db, flag, current_user.id, "deleted", None, flag.key)
    db.delete(flag)
    db.commit()
    return {"detail": "Feature flag deleted"}


@admin_router.get("/audit", response_model=List[AuditResponse])
def list_audit(
    flag_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("feature_flags")),
):
    query = db.query(FeatureFlagAuditLog)
    if flag_id:
        query = query.filter(FeatureFlagAuditLog.flag_id == flag_id)

    rows = query.order_by(FeatureFlagAuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    result = []
    for row in rows:
        flag = db.query(FeatureFlag).get(row.flag_id)
        result.append(AuditResponse(
            id=row.id,
            flag_id=row.flag_id,
            flag_key=flag.key if flag else None,
            changed_by=row.changed_by,
            field=row.field,
            old_value=row.old_value,
            new_value=row.new_value,
            created_at=row.created_at,
        ))
    return result


# ---------------------------------------------------------------------------
# Public-safe configuration
# ---------------------------------------------------------------------------

@public_router.get("/", response_model=PublicConfigResponse)
def public_config(db: Session = Depends(get_db)):
    flags = (
        db.query(FeatureFlag)
        .filter(FeatureFlag.scope.in_(["GLOBAL", "PUBLIC"]))
        .order_by(FeatureFlag.key.asc())
        .all()
    )
    return PublicConfigResponse(flags=[build_flag_response(f) for f in flags])