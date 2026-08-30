"""In-app notifications (Phase 3).

Scoped to the signed-in user: staff can only read/update their own
notifications.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.operations import Notification
from app.services.notifications import create_notification


router = APIRouter(prefix="/admin/notifications", tags=["admin-notifications"])


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    body: Optional[str] = None
    notification_type: str
    related_entity: Optional[str] = None
    related_id: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int


def build_response(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        title=notification.title,
        body=notification.body,
        notification_type=notification.notification_type,
        related_entity=notification.related_entity,
        related_id=notification.related_id,
        is_read=notification.is_read,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    unread_count = query.filter(Notification.is_read == False).count()  # noqa: E712
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712

    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return NotificationListResponse(
        notifications=[build_response(n) for n in notifications],
        unread_count=unread_count,
        total=total,
    )


@router.get("/unread-count", response_model=dict)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .count()
    )
    return {"unread_count": count}


@router.get("/{notification_id}", response_model=NotificationResponse)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).get(notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    return build_response(notification)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).get(notification_id)
    if not notification or notification.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.mark_read()
    db.commit()
    db.refresh(notification)
    return build_response(notification)


@router.post("/read-all", response_model=dict)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True, "read_at": now})
    db.commit()
    return {"detail": "All notifications marked as read"}


@router.post("/_test", status_code=status.HTTP_201_CREATED)
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = create_notification(
        db,
        user_id=current_user.id,
        title="Test notification",
        body="This is a test notification from the platform.",
        notification_type="GENERAL",
    )
    db.commit()
    db.refresh(notification)
    return {"detail": "Notification created", "id": notification.id}