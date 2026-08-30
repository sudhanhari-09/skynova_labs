"""Knowledge base (spec §33): articles + categories, public and staff scopes."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import KnowledgeArticle, KnowledgeCategory
from app.services.audit import log_action


router = APIRouter(prefix="/knowledge", tags=["knowledge"])
admin_router = APIRouter(prefix="/admin/knowledge", tags=["knowledge"])
public_router = APIRouter(prefix="/knowledge/public", tags=["knowledge"])


class CategoryPayload(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = 0


class ArticlePayload(BaseModel):
    title: str
    slug: Optional[str] = None
    category_id: Optional[int] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    related_project_id: Optional[int] = None
    related_technology: Optional[str] = None
    visibility: str = "INTERNAL"
    version: str = "1"
    is_published: bool = False


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _cat_dict(c: KnowledgeCategory) -> dict:
    return {"id": c.id, "name": c.name, "slug": c.slug, "description": c.description,
            "display_order": c.display_order}


def _article_dict(a: KnowledgeArticle, with_content=True) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "slug": a.slug,
        "category_id": a.category_id,
        "category": _cat_dict(a.category) if a.category else None,
        "content": a.content if with_content else None,
        "tags": a.tags or [],
        "related_project_id": a.related_project_id,
        "related_technology": a.related_technology,
        "visibility": a.visibility,
        "version": a.version,
        "is_published": a.is_published,
        "author_id": a.author_id,
        "created_at": a.created_at,
    }


@public_router.get("/")
def public_categories(db: Session = Depends(get_db)):
    cats = db.query(KnowledgeCategory).order_by(KnowledgeCategory.display_order).all()
    return [
        {**_cat_dict(c), "articles":
            [_article_dict(a, with_content=False) for a in db.query(KnowledgeArticle)
             .filter(KnowledgeArticle.category_id == c.id, KnowledgeArticle.visibility == "PUBLIC",
                     KnowledgeArticle.is_published == True)  # noqa: E712
             .all()]}
        for c in cats
    ]


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_cat_dict(c) for c in db.query(KnowledgeCategory).order_by(KnowledgeCategory.display_order).all()]


@admin_router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_category(data: CategoryPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    c = KnowledgeCategory(**data.model_dump(exclude_unset=True))
    c.slug = c.slug or _slugify(c.name)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _cat_dict(c)


@admin_router.patch("/categories/{category_id}")
def update_category(category_id: int, data: CategoryPayload, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    c = db.query(KnowledgeCategory).get(category_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    return _cat_dict(c)


@admin_router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db),
                    current_user: dict = Depends(get_current_user_dict)):
    c = db.query(KnowledgeCategory).get(category_id)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    db.delete(c)
    db.commit()
    return {"detail": "Category deleted"}


@router.get("/articles")
def list_articles(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
                  category_id: Optional[int] = None, search: Optional[str] = None):
    q = db.query(KnowledgeArticle)
    if category_id:
        q = q.filter(KnowledgeArticle.category_id == category_id)
    if search:
        q = q.filter(KnowledgeArticle.title.ilike(f"%{search}%"))
    return [_article_dict(a, with_content=False) for a in q.order_by(KnowledgeArticle.created_at.desc()).all()]


@router.get("/articles/{article_id}")
def get_article(article_id: int, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    a = db.query(KnowledgeArticle).get(article_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return _article_dict(a)


@admin_router.post("/articles", status_code=status.HTTP_201_CREATED)
def create_article(data: ArticlePayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    a = KnowledgeArticle(**data.model_dump(exclude_unset=True))
    a.slug = a.slug or _slugify(a.title)
    a.author_id = current_user["id"]
    db.add(a)
    db.flush()
    log_action(db, current_user["id"], "create", "knowledge", "article", a.id, new_value={"slug": a.slug})
    db.commit()
    db.refresh(a)
    return _article_dict(a)


@admin_router.patch("/articles/{article_id}")
def update_article(article_id: int, data: ArticlePayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    a = db.query(KnowledgeArticle).get(article_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    db.commit()
    return _article_dict(a)


@admin_router.delete("/articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    a = db.query(KnowledgeArticle).get(article_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    db.delete(a)
    db.commit()
    return {"detail": "Article deleted"}