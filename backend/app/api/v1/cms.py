"""CMS module: pages, page sections and blog posts (spec §34 CMS adoption).

Public endpoints serve published content; admin endpoints manage drafts,
visibility and SEO metadata.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import CMSPage, PageSection, BlogPost
from app.services.audit import log_action


router = APIRouter(prefix="/cms", tags=["cms"])
admin_router = APIRouter(prefix="/admin/cms", tags=["cms"])
public_router = APIRouter(prefix="/pages", tags=["cms"])


class PagePayload(BaseModel):
    title: str
    slug: Optional[str] = None
    content: Optional[str] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    robots: Optional[str] = None
    is_published: bool = False
    is_homepage: bool = False
    display_order: Optional[int] = 0


class SectionPayload(BaseModel):
    section_key: str
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    image_url: Optional[str] = None
    background: Optional[str] = None
    display_order: Optional[int] = 0
    is_enabled: bool = True
    visibility: str = "PUBLIC"


class BlogPayload(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    is_published: bool = False
    is_featured: bool = False
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    related_project_id: Optional[int] = None
    related_research_id: Optional[int] = None


class PagePatch(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    robots: Optional[str] = None
    is_published: Optional[bool] = None
    is_homepage: Optional[bool] = None
    display_order: Optional[int] = None


class SectionPatch(BaseModel):
    section_key: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    cta_text: Optional[str] = None
    cta_url: Optional[str] = None
    image_url: Optional[str] = None
    background: Optional[str] = None
    display_order: Optional[int] = None
    is_enabled: Optional[bool] = None
    visibility: Optional[str] = None


class BlogPatch(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image: Optional[str] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    related_project_id: Optional[int] = None
    related_research_id: Optional[int] = None


def _slugify(text: str) -> str:
    return text.strip().lower().replace(" ", "-")


def _page_dict(page: CMSPage) -> dict:
    return {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "content": page.content,
        "seo_title": page.seo_title,
        "meta_description": page.meta_description,
        "meta_keywords": page.meta_keywords,
        "canonical_url": page.canonical_url,
        "og_title": page.og_title,
        "og_description": page.og_description,
        "og_image": page.og_image,
        "robots": page.robots,
        "is_published": page.is_published,
        "is_homepage": page.is_homepage,
        "published_at": page.published_at,
        "display_order": page.display_order,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "sections": [
            {
                "id": s.id,
                "section_key": s.section_key,
                "title": s.title,
                "subtitle": s.subtitle,
                "content": s.content,
                "cta_text": s.cta_text,
                "cta_url": s.cta_url,
                "image_url": s.image_url,
                "background": s.background,
                "display_order": s.display_order,
                "is_enabled": s.is_enabled,
                "visibility": s.visibility,
            }
            for s in sorted(page.sections, key=lambda s: s.display_order or 0)
        ],
    }


def _blog_dict(post: BlogPost, with_author=True) -> dict:
    return {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "excerpt": post.excerpt,
        "content": post.content,
        "category": post.category,
        "tags": post.tags or [],
        "cover_image": post.cover_image,
        "is_published": post.is_published,
        "is_featured": post.is_featured,
        "published_at": post.published_at,
        "author": (post.author.first_name + " " + post.author.last_name).strip() if post.author else None,
        "seo_title": post.seo_title,
        "meta_description": post.meta_description,
        "related_project_id": post.related_project_id,
        "related_research_id": post.related_research_id,
        "created_at": post.created_at,
    }


# ---------------- Public ----------------

@public_router.get("/")
def list_pages(db: Session = Depends(get_db)):
    """Published pages and the site's public navigation sections."""
    pages = db.query(CMSPage).filter(CMSPage.is_published == True).order_by(CMSPage.display_order).all()  # noqa: E712
    return [_page_dict(p) for p in pages]


@public_router.get("/{slug}")
def get_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(CMSPage).filter(CMSPage.slug == slug).first()
    if not page or not page.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return _page_dict(page)


@router.get("/blog", tags=["cms"])
def list_blog_posts(db: Session = Depends(get_db), category: Optional[str] = None, limit: int = 50):
    q = db.query(BlogPost).filter(BlogPost.is_published == True)  # noqa: E712
    if category:
        q = q.filter(BlogPost.category == category)
    return [_blog_dict(p) for p in q.order_by(BlogPost.published_at.desc()).limit(limit).all()]


@router.get("/blog/{slug}")
def get_blog_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post or not post.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _blog_dict(post)


# ---------------- Admin ----------------

@admin_router.get("/pages")
def admin_list_pages(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_page_dict(p) for p in db.query(CMSPage).order_by(CMSPage.display_order).all()]


@admin_router.post("/pages", status_code=status.HTTP_201_CREATED)
def create_page(data: PagePayload, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    page = CMSPage(**data.model_dump(exclude_unset=True))
    page.slug = page.slug or _slugify(page.title)
    page.created_by = current_user["id"]
    if page.is_published:
        page.published_at = datetime.utcnow()
    db.add(page)
    db.flush()
    log_action(db, current_user["id"], "create", "cms", "page", page.id, new_value={"slug": page.slug})
    db.commit()
    db.refresh(page)
    return _page_dict(page)


@admin_router.patch("/pages/{page_id}")
def update_page(page_id: int, data: PagePatch, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    page = db.query(CMSPage).get(page_id)
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    old_published = page.is_published
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(page, field, value)
    page.updated_by = current_user["id"]
    if page.is_published and not old_published:
        page.published_at = datetime.utcnow()
    log_action(db, current_user["id"], "update", "cms", "page", page.id, new_value={"slug": page.slug})
    db.commit()
    db.refresh(page)
    return _page_dict(page)


@admin_router.delete("/pages/{page_id}")
def delete_page(page_id: int, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    page = db.query(CMSPage).get(page_id)
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    log_action(db, current_user["id"], "delete", "cms", "page", page.id, new_value={"slug": page.slug})
    db.delete(page)
    db.commit()
    return {"detail": "Page deleted"}


@admin_router.post("/pages/{page_id}/sections", status_code=status.HTTP_201_CREATED)
def create_section(page_id: int, data: SectionPayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    page = db.query(CMSPage).get(page_id)
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    section = PageSection(page_id=page.id, **data.model_dump(exclude_unset=True))
    db.add(section)
    db.commit()
    db.refresh(section)
    return _page_dict(page)


@admin_router.patch("/sections/{section_id}")
def update_section(section_id: int, data: SectionPatch, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    section = db.query(PageSection).get(section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    db.commit()
    db.refresh(section)
    return _page_dict(section.page)


@admin_router.delete("/sections/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    section = db.query(PageSection).get(section_id)
    if not section:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    db.delete(section)
    db.commit()
    return {"detail": "Section deleted"}


@admin_router.get("/blog")
def admin_list_blog(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_blog_dict(p) for p in db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()]


@admin_router.post("/blog", status_code=status.HTTP_201_CREATED)
def create_blog_payload(data: BlogPayload, db: Session = Depends(get_db),
                        current_user: dict = Depends(get_current_user_dict)):
    post = BlogPost(**data.model_dump(exclude_unset=True))
    post.slug = post.slug or _slugify(post.title)
    post.author_id = current_user["id"]
    if post.is_published:
        post.published_at = datetime.utcnow()
    db.add(post)
    db.flush()
    log_action(db, current_user["id"], "create", "cms", "blog", post.id, new_value={"slug": post.slug})
    db.commit()
    db.refresh(post)
    return _blog_dict(post)


@admin_router.patch("/blog/{post_id}")
def update_blog_post(post_id: int, data: BlogPatch, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    old_published = post.is_published
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    if post.is_published and not old_published:
        post.published_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return _blog_dict(post)


@admin_router.delete("/blog/{post_id}")
def delete_blog_post(post_id: int, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user_dict)):
    post = db.query(BlogPost).get(post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    log_action(db, current_user["id"], "delete", "cms", "blog", post.id, new_value={"slug": post.slug})
    db.delete(post)
    db.commit()
    return {"detail": "Post deleted"}