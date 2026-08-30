"""Media uploads (spec §59 storage). Saves to local storage by default;
records a MediaItem row and returns a public URL. Also exposes media CRUD."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.db import get_db
from app.api.deps import get_current_user_dict
from app.models.spec import MediaItem
from app.services.audit import log_action


router = APIRouter(prefix="/media", tags=["media"])
admin_router = APIRouter(prefix="/admin/media", tags=["media"])


def _media_dict(m: MediaItem) -> dict:
    return {
        "id": m.id,
        "file_name": m.file_name,
        "mime_type": m.mime_type,
        "size": m.size,
        "public_url": m.public_url,
        "related_entity": m.related_entity,
        "related_id": m.related_id,
        "is_public": m.is_public,
        "created_at": m.created_at,
    }


@admin_router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dict),
    related_entity: Optional[str] = None,
    related_id: Optional[int] = None,
    is_public: bool = False,
):
    """Store an uploaded file in local storage and register a MediaItem."""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    # Validate file type
    allowed_types = [t.strip() for t in settings.upload_allowed_types.split(",") if t.strip()]
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{file.content_type}' not allowed. Allowed: {', '.join(allowed_types[:10])}",
        )

    # Validate file size
    max_size = settings.upload_max_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.upload_max_size_mb}MB",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    storage_name = f"{uuid.uuid4().hex}{ext}"
    if settings.storage_type == "local":
        base = settings.storage_path or "./storage"
        os.makedirs(base, exist_ok=True)
        dest = os.path.join(base, storage_name)
        with open(dest, "wb") as fh:
            fh.write(content)
        size = len(content)
        public_url = f"{settings.backend_url}/media/{storage_name}"
    else:
        # S3-compatible hook: upload the bytes here when a client is configured.
        size = len(content)
        storage_name = f"s3://{storage_name}"
        public_url = storage_name

    item = MediaItem(
        file_name=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        size=size,
        storage_key=storage_name,
        public_url=public_url,
        uploaded_by=current_user["id"],
        related_entity=related_entity,
        related_id=related_id,
        is_public=is_public,
    )
    db.add(item)
    db.flush()
    log_action(db, current_user["id"], "upload", "media", "media", item.id, new_value={"file_name": file.filename})
    db.commit()
    db.refresh(item)
    return _media_dict(item)


@admin_router.get("/")
def list_media(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_dict),
               related_entity: Optional[str] = None, related_id: Optional[int] = None):
    q = db.query(MediaItem).order_by(MediaItem.created_at.desc())
    if related_entity:
        q = q.filter(MediaItem.related_entity == related_entity)
    if related_id:
        q = q.filter(MediaItem.related_id == related_id)
    return [_media_dict(m) for m in q.all()]


@admin_router.delete("/{media_id}")
def delete_media(media_id: int, db: Session = Depends(get_db),
                 current_user: dict = Depends(get_current_user_dict)):
    m = db.query(MediaItem).get(media_id)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    if settings.storage_type == "local" and m.storage_key and "://" not in m.storage_key:
        try:
            os.remove(os.path.join(settings.storage_path or "./storage", m.storage_key))
        except OSError:
            pass
    db.delete(m)
    db.commit()
    return {"detail": "Media deleted"}