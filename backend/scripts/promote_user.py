"""Promote a registered user to a staff role.

Usage:
    python scripts/promote_user.py <email> <role>

Example:
    python scripts/promote_user.py admin@projectlabs.io Super Admin
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import SessionLocal
from app.models.auth import Role, User, UserRole


def promote(email: str, role_name: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User not found: {email}")
            raise SystemExit(1)

        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            print(f"Role not found: {role_name}")
            raise SystemExit(1)

        existing = (
            db.query(UserRole)
            .filter(UserRole.user_id == user.id, UserRole.role_id == role.id)
            .first()
        )
        if existing:
            print(f"{email} already has role '{role_name}'")
        else:
            db.add(UserRole(user_id=user.id, role_id=role.id))
            db.commit()
            print(f"Promoted {email} to '{role_name}'")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(1)
    promote(sys.argv[1].strip(), sys.argv[2].strip())