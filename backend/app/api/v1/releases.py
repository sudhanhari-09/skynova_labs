"""Product releases (Phase 4).

Schedule, track and roll back releases. Releasing marks the linked version as
RELEASED and advances the product's current_version (when no explicit version
is given).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import ProductRelease, Product, ProductVersion


router = APIRouter(prefix="/admin/releases", tags=["admin-releases"])


class ReleaseCreate(BaseModel):
    product_id: int
    version_id: Optional[int] = None
    name: str = Field(..., min_length=1)
    release_notes: Optional[str] = None
    status: str = "SCHEDULED"
    environment: str = "PRODUCTION"
    scheduled_for: Optional[datetime] = None


class ReleaseUpdate(BaseModel):
    name: Optional[str] = None
    release_notes: Optional[str] = None
    status: Optional[str] = None
    environment: Optional[str] = None
    scheduled_for: Optional[datetime] = None


class ReleaseResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    version_id: Optional[int] = None
    version_version: Optional[str] = None
    name: str
    release_notes: Optional[str] = None
    status: str
    environment: str
    scheduled_for: Optional[datetime] = None
    released_at: Optional[datetime] = None
    rolled_back_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


RELEASE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "RELEASED", "ROLLED_BACK"]
ENVIRONMENTS = ["PRODUCTION", "STAGING"]


def build_release_response(db: Session, release: ProductRelease) -> ReleaseResponse:
    product = db.query(Product).get(release.product_id)
    version = db.query(ProductVersion).get(release.version_id) if release.version_id else None
    return ReleaseResponse(
        id=release.id,
        product_id=release.product_id,
        product_name=product.name if product else None,
        version_id=release.version_id,
        version_version=version.version if version else None,
        name=release.name,
        release_notes=release.release_notes,
        status=release.status,
        environment=release.environment,
        scheduled_for=release.scheduled_for,
        released_at=release.released_at,
        rolled_back_at=release.rolled_back_at,
        created_at=release.created_at,
        updated_at=release.updated_at,
    )


@router.post("/", response_model=ReleaseResponse, status_code=status.HTTP_201_CREATED)
def create_release(
    data: ReleaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    if data.status not in RELEASE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    if data.environment not in ENVIRONMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid environment: {data.environment}")
    product = db.query(Product).get(data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if data.version_id:
        version = db.query(ProductVersion).get(data.version_id)
        if not version or version.product_id != data.product_id:
            raise HTTPException(status_code=404, detail="Version not found for this product")

    release = ProductRelease(
        product_id=data.product_id,
        version_id=data.version_id,
        name=data.name,
        release_notes=data.release_notes,
        status=data.status,
        environment=data.environment,
        scheduled_for=data.scheduled_for,
        created_by=current_user.id,
    )
    db.add(release)
    db.commit()
    db.refresh(release)
    return build_release_response(db, release)


@router.get("/", response_model=List[ReleaseResponse])
def list_releases(
    product_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    environment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    query = db.query(ProductRelease)
    if product_id:
        query = query.filter(ProductRelease.product_id == product_id)
    if status_filter:
        query = query.filter(ProductRelease.status == status_filter)
    if environment:
        query = query.filter(ProductRelease.environment == environment)
    releases = query.order_by(ProductRelease.scheduled_for.desc(), ProductRelease.created_at.desc()).all()
    return [build_release_response(db, r) for r in releases]


@router.get("/{release_id}", response_model=ReleaseResponse)
def get_release(
    release_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    release = db.query(ProductRelease).get(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    return build_release_response(db, release)


@router.patch("/{release_id}", response_model=ReleaseResponse)
def update_release(
    release_id: int,
    data: ReleaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    release = db.query(ProductRelease).get(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in RELEASE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if "environment" in update_data and update_data["environment"] not in ENVIRONMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid environment: {update_data['environment']}")

    for field, value in update_data.items():
        setattr(release, field, value)

    # Transition side-effects.
    if release.status == "RELEASED" and not release.released_at:
        release.released_at = datetime.utcnow()
        if release.version_id:
            version = db.query(ProductVersion).get(release.version_id)
            if version:
                version.status = "RELEASED"
                version.release_date = version.release_date or datetime.utcnow()
                product = db.query(Product).get(release.product_id)
                if product:
                    product.current_version = version.version
    if release.status == "ROLLED_BACK" and not release.rolled_back_at:
        release.rolled_back_at = datetime.utcnow()

    db.commit()
    db.refresh(release)
    return build_release_response(db, release)


@router.post("/{release_id}/release", response_model=ReleaseResponse)
def mark_released(
    release_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    release = db.query(ProductRelease).get(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    if release.status == "ROLLED_BACK":
        raise HTTPException(status_code=400, detail="Cannot release a rolled-back release")

    release.status = "RELEASED"
    release.released_at = release.released_at or datetime.utcnow()
    if release.version_id:
        version = db.query(ProductVersion).get(release.version_id)
        if version:
            version.status = "RELEASED"
            version.release_date = version.release_date or datetime.utcnow()
            product = db.query(Product).get(release.product_id)
            if product:
                product.current_version = version.version
    db.commit()
    db.refresh(release)
    return build_release_response(db, release)


@router.post("/{release_id}/rollback", response_model=ReleaseResponse)
def rollback_release(
    release_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    release = db.query(ProductRelease).get(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")

    release.status = "ROLLED_BACK"
    release.rolled_back_at = release.rolled_back_at or datetime.utcnow()
    db.commit()
    db.refresh(release)
    return build_release_response(db, release)


@router.delete("/{release_id}", status_code=200)
def delete_release(
    release_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("releases")),
):
    release = db.query(ProductRelease).get(release_id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    db.delete(release)
    db.commit()
    return {"detail": "Release deleted"}