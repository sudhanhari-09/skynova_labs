"""One-off end-to-end check of the admin calendar flow exactly as the new
frontend page drives it (naive local ISO strings, month-window GET, PATCH
edit, DELETE) with real DB persistence verified row-by-row.

Run:  .venv\\Scripts\\python.exe scripts/e2e_calendar_check.py   (from backend/)
"""
import sys
import uuid
from datetime import date, timedelta

sys.path.insert(0, ".")

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app
from app.models.auth import Role, User
from app.security import get_password_hash

BASE = "http://testserver"


def uniq(prefix):
    return f"{prefix}{uuid.uuid4().hex[:10]}"


client = TestClient(app, raise_server_exceptions=False)

# --- admin login (same bootstrap as tests/test_calendar_events.py) ---
session = SessionLocal()
email = uniq("cale2e") + "@mail.example"
role = session.query(Role).filter(Role.name == "Super Admin").first()
if role is None:
    role = Role(name="Super Admin", description="E2E super admin")
    session.add(role)
    session.flush()
user = User(
    email=email,
    password_hash=get_password_hash("Str0ng!Pass9"),
    first_name="Cal",
    last_name="E2E",
    is_active=True,
    is_verified=True,
)
user.roles.append(role)
session.add(user)
session.commit()
session.refresh(user)
uid = user.id
session.close()

r = client.post("/auth/login", json={"email": email, "password": "Str0ng!Pass9"})
assert r.status_code == 200, r.text
headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
print("login: OK")

# --- 1) create via POST (same payload shape the form sends) ---
today = date.today()
delta = (0 - today.weekday()) % 7  # next Monday
monday = today + timedelta(days=delta)
if monday <= today:
    monday += timedelta(days=7)

create_payload = {
    "title": "E2E Smoke Event",
    "event_type": "MEETING",
    "starts_at": f"{monday.isoformat()}T09:00:00",
    "ends_at": f"{monday.isoformat()}T10:00:00",
    "all_day": False,
    "location": "Lab",
    "description": "E2E check",
}
r = client.post("/admin/calendar/", json=create_payload, headers=headers)
assert r.status_code in (200, 201), r.text
event = r.json()
event_id = event["id"]
print(f"create: OK (id={event_id}, starts_at={event['starts_at']!r})")

# --- 2) month-window GET (what the grid does) sees it ---
month_start = monday.replace(day=1)
if monday.month == 12:
    nxt = date(monday.year + 1, 1, 1)
else:
    nxt = date(monday.year, monday.month + 1, 1)
grid_start = (month_start - timedelta(days=month_start.weekday())).isoformat() + "T00:00:00"
grid_end = (nxt - timedelta(days=1)).isoformat() + "T23:59:59"
r = client.get(
    f"/admin/calendar/?start={grid_start}&end={grid_end}", headers=headers
)
assert r.status_code == 200, r.text
ids = [e["id"] for e in r.json()]
assert event_id in ids, "created event missing from month window"
print(f"month GET: OK ({len(ids)} event(s) in window)")

# --- 3) PATCH edit persists ---
r = client.patch(
    f"/admin/calendar/{event_id}",
    json={
        "title": "E2E Smoke Event EDITED",
        "starts_at": f"{monday.isoformat()}T11:30:00",
        "ends_at": f"{monday.isoformat()}T12:30:00",
    },
    headers=headers,
)
assert r.status_code == 200, r.text
print("update: OK")

# --- 4) verify persisted rows in the database ---
s = SessionLocal()
row = s.execute(
    text("SELECT title, starts_at FROM calendar_events WHERE id = :i"), {"i": event_id}
).first()
assert row is not None, "row missing after update"
assert row[0] == "E2E Smoke Event EDITED", f"title not persisted: {row[0]!r}"
assert row[1].strftime("%Y-%m-%dT%H:%M:%S") == f"{monday.isoformat()}T11:30:00", f"starts_at not persisted: {row[1]!r}"
s.close()
print("db persist: OK (title + starts_at match)")

# --- 5) DELETE removes it for good ---
r = client.delete(f"/admin/calendar/{event_id}", headers=headers)
assert r.status_code in (200, 204), r.text
s = SessionLocal()
gone = s.execute(text("SELECT 1 FROM calendar_events WHERE id = :i"), {"i": event_id}).first()
s.close()
assert gone is None, "row still present after delete"
print("delete: OK (row gone)")

# --- cleanup admin user ---
session = SessionLocal()
for sql, params in [
    ("DELETE FROM notifications WHERE user_id = :u", {"u": uid}),
    ("DELETE FROM audit_logs WHERE user_id = :u", {"u": uid}),
    ("DELETE FROM token_sessions WHERE user_id = :u", {"u": uid}),
    ("DELETE FROM login_attempts WHERE email = :e", {"e": email}),
    ("DELETE FROM user_roles WHERE user_id = :u", {"u": uid}),
    ("DELETE FROM users WHERE id = :u", {"u": uid}),
]:
    session.execute(text(sql), params)
session.commit()
session.close()
print("cleanup: OK")
print("E2E CALENDAR FLOW: ALL CHECKS PASSED")