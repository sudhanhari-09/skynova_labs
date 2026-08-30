"""Public site content: FAQs, testimonials, team, partners, achievements and
navigation items (spec §34 / §66 content domains)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import (
    Faq, Testimonial, TeamMember, Partner, Achievement, NavigationItem,
)
from app.services.audit import log_action


router = APIRouter(prefix="/content", tags=["content"])
admin_router = APIRouter(prefix="/admin/content", tags=["content"])
nav_router = APIRouter(prefix="/navigation", tags=["content"])


# ---------------- Navigation ----------------

class NavPayload(BaseModel):
    label: str
    url: str
    parent_id: Optional[int] = None
    location: str = "header"
    display_order: Optional[int] = 0
    is_published: bool = True


@nav_router.get("/")
def get_navigation(db: Session = Depends(get_db)):
    items = db.query(NavigationItem).filter(NavigationItem.is_published == True).order_by(  # noqa: E712
        NavigationItem.location, NavigationItem.display_order
    ).all()
    root = [i for i in items if i.parent_id is None]
    return [
        {
            "id": i.id,
            "label": i.label,
            "url": i.url,
            "location": i.location,
            "display_order": i.display_order,
            "children": [
                {"id": c.id, "label": c.label, "url": c.url, "display_order": c.display_order}
                for c in items if c.parent_id == i.id
            ],
        }
        for i in root
    ]


@admin_router.get("/navigation")
def admin_list_nav(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    items = db.query(NavigationItem).order_by(NavigationItem.location, NavigationItem.display_order).all()
    return [
        {
            "id": i.id,
            "label": i.label,
            "url": i.url,
            "parent_id": i.parent_id,
            "location": i.location,
            "display_order": i.display_order,
            "is_published": i.is_published,
            "created_at": i.created_at,
        }
        for i in items
    ]


@admin_router.post("/navigation", status_code=status.HTTP_201_CREATED)
def create_nav_item(
    data: NavPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    item = NavigationItem(**data.model_dump())
    db.add(item)
    db.flush()
    log_action(db, current_user["id"], "create", "content", "navigation", item.id,
               new_value={"label": item.label})
    db.commit()
    db.refresh(item)
    return {"id": item.id, "label": item.label, "url": item.url, "location": item.location}


@admin_router.patch("/navigation/{item_id}")
def update_nav_item(
    item_id: int,
    data: NavPayload,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    item = db.query(NavigationItem).get(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nav item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return {"detail": "Nav item updated", "id": item.id}


@admin_router.delete("/navigation/{item_id}")
def delete_nav_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
):
    item = db.query(NavigationItem).get(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nav item not found")
    db.delete(item)
    db.commit()
    return {"detail": "Nav item deleted"}


# ---------------- FAQs ----------------

class FaqPayload(BaseModel):
    question: str
    answer: str
    category: Optional[str] = None
    display_order: Optional[int] = 0
    is_published: bool = True


@router.get("/faqs")
def list_faqs(db: Session = Depends(get_db), category: Optional[str] = None):
    q = db.query(Faq).filter(Faq.is_published == True)  # noqa: E712
    if category:
        q = q.filter(Faq.category == category)
    return [
        {"id": f.id, "question": f.question, "answer": f.answer,
         "category": f.category, "display_order": f.display_order}
        for f in q.order_by(Faq.display_order).all()
    ]


@admin_router.post("/faqs", status_code=status.HTTP_201_CREATED)
def create_faq(data: FaqPayload, db: Session = Depends(get_db),
               current_user: dict = Depends(get_current_user_dict)):
    f = Faq(**data.model_dump(exclude_unset=True))
    db.add(f)
    db.flush()
    log_action(db, current_user["id"], "create", "content", "faq", f.id, new_value={"question": f.question})
    db.commit()
    db.refresh(f)
    return {"id": f.id, "question": f.question, "answer": f.answer}


@admin_router.patch("/faqs/{faq_id}")
def update_faq(faq_id: int, data: FaqPayload, db: Session = Depends(get_db),
               current_user: dict = Depends(get_current_user_dict)):
    f = db.query(Faq).get(faq_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(f, field, value)
    db.commit()
    return {"id": f.id, "question": f.question, "answer": f.answer}


@admin_router.delete("/faqs/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db),
               current_user: dict = Depends(get_current_user_dict)):
    f = db.query(Faq).get(faq_id)
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
    db.delete(f)
    db.commit()
    return {"detail": "FAQ deleted"}


# ---------------- Testimonials ----------------

class TestimonialPayload(BaseModel):
    name: str
    role: Optional[str] = None
    company: Optional[str] = None
    content: str
    rating: Optional[int] = None
    image_url: Optional[str] = None
    display_order: Optional[int] = 0
    is_published: bool = True


@router.get("/testimonials")
def list_testimonials(db: Session = Depends(get_db)):
    ts = db.query(Testimonial).filter(Testimonial.is_published == True).order_by(Testimonial.display_order).all()  # noqa: E712
    return [
        {"id": t.id, "name": t.name, "role": t.role, "company": t.company,
         "content": t.content, "rating": t.rating, "image_url": t.image_url}
        for t in ts
    ]


@admin_router.post("/testimonials", status_code=status.HTTP_201_CREATED)
def create_testimonial(data: TestimonialPayload, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    t = Testimonial(**data.model_dump(exclude_unset=True))
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name}


@admin_router.patch("/testimonials/{testimonial_id}")
def update_testimonial(testimonial_id: int, data: TestimonialPayload, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    t = db.query(Testimonial).get(testimonial_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Testimonial not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    db.commit()
    return {"id": t.id, "name": t.name}


@admin_router.delete("/testimonials/{testimonial_id}")
def delete_testimonial(testimonial_id: int, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    t = db.query(Testimonial).get(testimonial_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Testimonial not found")
    db.delete(t)
    db.commit()
    return {"detail": "Testimonial deleted"}


# ---------------- Team ----------------

class TeamPayload(BaseModel):
    name: str
    position: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    technologies: Optional[List[str]] = None
    availability: Optional[str] = None
    photo_url: Optional[str] = None
    email: Optional[str] = None
    display_order: Optional[int] = 0
    is_published: bool = True


@router.get("/team")
def list_team(db: Session = Depends(get_db)):
    members = db.query(TeamMember).filter(TeamMember.is_published == True).order_by(TeamMember.display_order).all()  # noqa: E712
    return [
        {"id": m.id, "name": m.name, "position": m.position, "department": m.department,
         "bio": m.bio, "skills": m.skills or [], "technologies": m.technologies or [],
         "availability": m.availability, "photo_url": m.photo_url, "email": m.email}
        for m in members
    ]


@admin_router.post("/team", status_code=status.HTTP_201_CREATED)
def create_team(data: TeamPayload, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    m = TeamMember(**data.model_dump(exclude_unset=True))
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "name": m.name}


@admin_router.patch("/team/{member_id}")
def update_team(member_id: int, data: TeamPayload, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    m = db.query(TeamMember).get(member_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(m, field, value)
    db.commit()
    return {"id": m.id, "name": m.name}


@admin_router.delete("/team/{member_id}")
def delete_team(member_id: int, db: Session = Depends(get_db),
                current_user: dict = Depends(get_current_user_dict)):
    m = db.query(TeamMember).get(member_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    db.delete(m)
    db.commit()
    return {"detail": "Member deleted"}


# ---------------- Partners ----------------

class PartnerPayload(BaseModel):
    name: str
    slug: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    partner_type: Optional[str] = None
    display_order: Optional[int] = 0
    is_published: bool = True


@router.get("/partners")
def list_partners(db: Session = Depends(get_db)):
    ps = db.query(Partner).filter(Partner.is_published == True).order_by(Partner.display_order).all()  # noqa: E712
    return [
        {"id": p.id, "name": p.name, "slug": p.slug, "logo_url": p.logo_url,
         "description": p.description, "website_url": p.website_url,
         "partner_type": p.partner_type}
        for p in ps
    ]


@admin_router.post("/partners", status_code=status.HTTP_201_CREATED)
def create_partner(data: PartnerPayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    p = Partner(**data.model_dump(exclude_unset=True))
    p.slug = p.slug or data.name.strip().lower().replace(" ", "-")
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"id": p.id, "name": p.name}


@admin_router.patch("/partners/{partner_id}")
def update_partner(partner_id: int, data: PartnerPayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    p = db.query(Partner).get(partner_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    return {"id": p.id, "name": p.name}


@admin_router.delete("/partners/{partner_id}")
def delete_partner(partner_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    p = db.query(Partner).get(partner_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    db.delete(p)
    db.commit()
    return {"detail": "Partner deleted"}


# ---------------- Achievements ----------------

class AchievementPayload(BaseModel):
    title: str
    description: Optional[str] = None
    achievement_date: Optional[datetime] = None
    category: Optional[str] = None
    metric: Optional[str] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    display_order: Optional[int] = 0
    is_published: bool = True


@router.get("/achievements")
def list_achievements(db: Session = Depends(get_db)):
    as_ = db.query(Achievement).filter(Achievement.is_published == True).order_by(Achievement.display_order).all()  # noqa: E712
    return [
        {"id": a.id, "title": a.title, "description": a.description,
         "achievement_date": a.achievement_date, "category": a.category,
         "metric": a.metric, "image_url": a.image_url, "is_featured": a.is_featured}
        for a in as_
    ]


@admin_router.post("/achievements", status_code=status.HTTP_201_CREATED)
def create_achievement(data: AchievementPayload, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    a = Achievement(**data.model_dump(exclude_unset=True))
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id, "title": a.title}


@admin_router.patch("/achievements/{achievement_id}")
def update_achievement(achievement_id: int, data: AchievementPayload, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    a = db.query(Achievement).get(achievement_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    db.commit()
    return {"id": a.id, "title": a.title}


@admin_router.delete("/achievements/{achievement_id}")
def delete_achievement(achievement_id: int, db: Session = Depends(get_db),
                       current_user: dict = Depends(get_current_user_dict)):
    a = db.query(Achievement).get(achievement_id)
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found")
    db.delete(a)
    db.commit()
    return {"detail": "Achievement deleted"}


@admin_router.get("/all")
def admin_list_all(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return {
        "faqs": db.query(Faq).count(),
        "testimonials": db.query(Testimonial).count(),
        "team": db.query(TeamMember).count(),
        "partners": db.query(Partner).count(),
        "achievements": db.query(Achievement).count(),
        "navigation": db.query(NavigationItem).count(),
    }