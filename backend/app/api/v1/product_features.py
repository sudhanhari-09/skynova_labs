"""Product features (spec §31) - CRUD sub-resource of product detail pages."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import ProductFeature
from app.models.operations import Product
from app.services.audit import log_action


router = APIRouter(prefix="/admin/products/{product_id}/features", tags=["products"])


class FeaturePayload(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "PLANNED"
    priority: str = "MEDIUM"
    target_quarter: Optional[str] = None
    display_order: Optional[int] = 0


def _feature_dict(f: ProductFeature) -> dict:
    return {
        "id": f.id,
        "product_id": f.product_id,
        "title": f.title,
        "description": f.description,
        "status": f.status,
        "priority": f.priority,
        "target_quarter": f.target_quarter,
        "display_order": f.display_order,
        "created_at": f.created_at,
    }


def _get_product(db: Session, pid: int) -> Product:
    p = db.query(Product).get(pid)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return p


@router.get("/")
def list_features(product_id: int, db: Session = Depends(get_db),
                  current_user: dict = Depends(get_current_user_dict)):
    _get_product(db, product_id)
    return [_feature_dict(f) for f in db.query(ProductFeature)
            .filter(ProductFeature.product_id == product_id).order_by(ProductFeature.display_order).all()]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_feature(product_id: int, data: FeaturePayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    _get_product(db, product_id)
    f = ProductFeature(product_id=product_id, **data.model_dump(exclude_unset=True))
    db.add(f)
    db.flush()
    log_action(db, current_user["id"], "create", "products", "feature", f.id, new_value={"title": f.title})
    db.commit()
    db.refresh(f)
    return _feature_dict(f)


@router.patch("/{feature_id}")
def update_feature(product_id: int, feature_id: int, data: FeaturePayload,
                   db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    f = db.query(ProductFeature).get(feature_id)
    if not f or f.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(f, field, value)
    db.commit()
    db.refresh(f)
    return _feature_dict(f)


@router.delete("/{feature_id}")
def delete_feature(product_id: int, feature_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    f = db.query(ProductFeature).get(feature_id)
    if not f or f.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature not found")
    db.delete(f)
    db.commit()
    return {"detail": "Feature deleted"}