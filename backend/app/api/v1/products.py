"""Product management (Phase 4) — products and versions.

Products are the catalog the platform ships; versions track semver milestones.
Hidden entirely when the `products` feature flag is disabled.
"""
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user, require_feature
from app.models.auth import User
from app.models.operations import Product, ProductVersion


router = APIRouter(prefix="/admin/products", tags=["admin-products"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1)
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: str = "CONCEPT"
    current_version: Optional[str] = None
    platform: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    current_version: Optional[str] = None
    platform: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: str
    current_version: Optional[str] = None
    platform: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    versions_count: int = 0
    releases_count: int = 0
    roadmap_items_count: int = 0

    class Config:
        from_attributes = True


class VersionCreate(BaseModel):
    product_id: int
    version: str = Field(..., min_length=1)
    name: Optional[str] = None
    notes: Optional[str] = None
    changelog: Optional[str] = None
    status: str = "PLANNED"
    release_date: Optional[datetime] = None


class VersionUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    changelog: Optional[str] = None
    status: Optional[str] = None
    release_date: Optional[datetime] = None
    version: Optional[str] = None


class VersionResponse(BaseModel):
    id: int
    product_id: int
    version: str
    name: Optional[str] = None
    notes: Optional[str] = None
    changelog: Optional[str] = None
    status: str
    release_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    total: int


PRODUCT_STATUSES = ["CONCEPT", "IN_DEVELOPMENT", "BETA", "LAUNCHED", "SUNSET"]
VERSION_STATUSES = ["PLANNED", "IN_PROGRESS", "BETA", "RELEASED", "ARCHIVED"]
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "product"


def build_product_response(db: Session, product: Product) -> ProductResponse:
    def count(model) -> int:
        return db.query(model).filter(model.product_id == product.id).count()

    from app.models.operations import ProductRelease, RoadmapItem
    return ProductResponse(
        id=product.id,
        name=product.name,
        slug=product.slug,
        description=product.description,
        category=product.category,
        status=product.status,
        current_version=product.current_version,
        platform=product.platform,
        tags=product.tags,
        is_active=product.is_active,
        created_at=product.created_at,
        updated_at=product.updated_at,
        versions_count=count(ProductVersion),
        releases_count=count(ProductRelease),
        roadmap_items_count=count(RoadmapItem),
    )


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    if data.status not in PRODUCT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    slug = data.slug or slugify(data.name)
    if db.query(Product).filter(Product.slug == slug).first():
        raise HTTPException(status_code=400, detail=f"Product slug already exists: {slug}")

    product = Product(
        name=data.name,
        slug=slug,
        description=data.description,
        category=data.category,
        status=data.status,
        current_version=data.current_version,
        platform=data.platform,
        tags=data.tags,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return build_product_response(db, product)


@router.get("/", response_model=ProductListResponse)
def list_products(
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    query = db.query(Product)
    if status_filter:
        query = query.filter(Product.status == status_filter)
    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter((Product.name.ilike(f"%{search}%")) | (Product.slug.ilike(f"%{search}%")))

    total = query.count()
    products = query.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ProductListResponse(
        products=[build_product_response(db, p) for p in products],
        total=total,
    )


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    product = db.query(Product).get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return build_product_response(db, product)


@router.get("/{product_id}/versions", response_model=List[VersionResponse])
def get_product_versions(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    product = db.query(Product).get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    versions = db.query(ProductVersion).filter(ProductVersion.product_id == product_id).order_by(ProductVersion.created_at.desc()).all()
    return versions


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    product = db.query(Product).get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in PRODUCT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")
    if "slug" in update_data:
        existing = db.query(Product).filter(Product.slug == update_data["slug"], Product.id != product_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Product slug already exists")

    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return build_product_response(db, product)


@router.delete("/{product_id}", status_code=200)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    product = db.query(Product).get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    name = product.name
    db.delete(product)
    db.commit()
    return {"detail": f"Product '{name}' deleted"}


# ---------------------------------------------------------------------------
# Versions
# ---------------------------------------------------------------------------

@router.post("/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    data: VersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    product = db.query(Product).get(data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if data.status not in VERSION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
    if SEMVER.match(data.version):
        existing = (
            db.query(ProductVersion)
            .filter(ProductVersion.product_id == data.product_id, ProductVersion.version == data.version)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Version already exists for this product")

    version = ProductVersion(
        product_id=data.product_id,
        version=data.version,
        name=data.name,
        notes=data.notes,
        changelog=data.changelog,
        status=data.status,
        release_date=data.release_date,
        created_by=current_user.id,
    )
    db.add(version)
    if data.status == "RELEASED":
        product.current_version = data.version
    db.commit()
    db.refresh(version)
    return version


@router.patch("/versions/{version_id}", response_model=VersionResponse)
def update_version(
    version_id: int,
    data: VersionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    version = db.query(ProductVersion).get(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] not in VERSION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update_data['status']}")

    for field, value in update_data.items():
        setattr(version, field, value)

    if version.status == "RELEASED":
        product = db.query(Product).get(version.product_id)
        if product:
            product.current_version = version.version

    db.commit()
    db.refresh(version)
    return version


@router.delete("/versions/{version_id}", status_code=200)
def delete_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("products")),
):
    version = db.query(ProductVersion).get(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    db.delete(version)
    db.commit()
    return {"detail": "Version deleted"}