"""Website settings + themes (spec §35 / §37). Admin manages them; a public
read-only endpoint exposes the active theme and public settings for the SPA."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import WebsiteSetting, Theme
from app.services.audit import log_action


router = APIRouter(prefix="/website", tags=["website"])
admin_router = APIRouter(prefix="/admin/website", tags=["website"])
public_router = APIRouter(prefix="/public/site", tags=["website"])


class SettingPayload(BaseModel):
    value_type: str = "string"
    value_text: Optional[str] = None
    value_json: Optional[Any] = None
    description: Optional[str] = None
    is_public: bool = False


class ThemePayload(BaseModel):
    name: str
    is_active: bool = False
    palette: Optional[dict] = None
    fonts: Optional[dict] = None
    ui: Optional[dict] = None
    layout: Optional[dict] = None
    appearance: str = "light"
    is_preset: bool = False


def _setting_dict(s: WebsiteSetting) -> dict:
    if s.value_type == "json":
        value = s.value_json
    elif s.value_type == "bool":
        value = (s.value_text or "").lower() in ("true", "1", "yes")
    elif s.value_type == "int":
        try:
            value = int(s.value_text or 0)
        except ValueError:
            value = 0
    else:
        value = s.value_text
    return {"key": s.key, "value": value, "value_type": s.value_type, "description": s.description, "is_public": s.is_public}


def _theme_dict(t: Theme) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "is_active": t.is_active,
        "palette": t.palette or {},
        "fonts": t.fonts or {},
        "ui": t.ui or {},
        "layout": t.layout or {},
        "appearance": t.appearance,
        "is_preset": t.is_preset,
    }


@public_router.get("/")
def public_config(db: Session = Depends(get_db)):
    theme = db.query(Theme).filter(Theme.is_active == True).first()  # noqa: E712
    settings = db.query(WebsiteSetting).filter(WebsiteSetting.is_public == True).all()  # noqa: E712
    return {
        "theme": _theme_dict(theme) if theme else {"name": "default", "palette": {}, "fonts": {}, "ui": {}, "layout": {}, "appearance": "light"},
        "settings": {s.key: _setting_dict(s)["value"] for s in settings},
    }


@admin_router.get("/settings")
def list_settings(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_setting_dict(s) for s in db.query(WebsiteSetting).order_by(WebsiteSetting.key).all()]


@admin_router.put("/settings/{key}")
def upsert_setting(key: str, data: SettingPayload, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    s = db.query(WebsiteSetting).filter(WebsiteSetting.key == key).first()
    if not s:
        s = WebsiteSetting(key=key)
        db.add(s)
    s.value_type = data.value_type
    s.value_text = data.value_text if data.value_type != "json" else None
    s.value_json = data.value_json if data.value_type == "json" else None
    s.description = data.description
    s.is_public = data.is_public
    log_action(db, current_user["id"], "upsert", "website", "setting", s.id, new_value={key: data.value_text})
    db.commit()
    db.refresh(s)
    return _setting_dict(s)


@admin_router.delete("/settings/{key}")
def delete_setting(key: str, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    s = db.query(WebsiteSetting).filter(WebsiteSetting.key == key).first()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Setting not found")
    db.delete(s)
    db.commit()
    return {"detail": "Setting deleted"}


@admin_router.get("/themes")
def list_themes(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict)):
    return [_theme_dict(t) for t in db.query(Theme).order_by(Theme.name).all()]


@admin_router.post("/themes", status_code=status.HTTP_201_CREATED)
def create_theme(data: ThemePayload, db: Session = Depends(get_db),
                 current_user: dict = Depends(get_current_user_dict)):
    if db.query(Theme).filter(Theme.name == data.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Theme name already exists")
    t = Theme(**data.model_dump(exclude_unset=True))
    if t.is_active:
        db.query(Theme).update({Theme.is_active: False})
    db.add(t)
    log_action(db, current_user["id"], "create", "website", "theme", None, new_value={"name": t.name})
    db.commit()
    db.refresh(t)
    return _theme_dict(t)


@admin_router.patch("/themes/{theme_id}")
def update_theme(theme_id: int, data: ThemePayload, db: Session = Depends(get_db),
                 current_user: dict = Depends(get_current_user_dict)):
    t = db.query(Theme).get(theme_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")
    was_active = t.is_active
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(t, field, value)
    if t.is_active and not was_active:
        db.query(Theme).filter(Theme.id != t.id).update({Theme.is_active: False})
    log_action(db, current_user["id"], "update", "website", "theme", t.id, new_value={"name": t.name, "is_active": t.is_active})
    db.commit()
    db.refresh(t)
    return _theme_dict(t)


@admin_router.post("/themes/{theme_id}/activate")
def activate_theme(theme_id: int, db: Session = Depends(get_db),
                   current_user: dict = Depends(get_current_user_dict)):
    t = db.query(Theme).get(theme_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")
    db.query(Theme).update({Theme.is_active: False})
    t.is_active = True
    db.commit()
    return _theme_dict(t)


@admin_router.delete("/themes/{theme_id}")
def delete_theme(theme_id: int, db: Session = Depends(get_db),
                 current_user: dict = Depends(get_current_user_dict)):
    t = db.query(Theme).get(theme_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme not found")
    if t.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the active theme")
    db.delete(t)
    db.commit()
    return {"detail": "Theme deleted"}