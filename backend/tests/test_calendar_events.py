"""Admin calendar / event API tests — strict date validation + real CRUD.

Covers the admin event calendar end-to-end against the live PostgreSQL-backed
app:

  * strict calendar date rules (4-digit years, real month/day, leap years)
    at the service, schema and HTTP layers,
  * create -> list -> update -> delete round trip through the real API,
  * month-window queries used by the calendar grid (including multi-day
    overlap),
  * regression checks that the pre-existing calendar endpoints still work.

Run:  python -m pytest -q tests/test_calendar_events.py  (from backend/)
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pydantic_core import PydanticCustomError
from sqlalchemy import text

from app.api.v1.calendar import CalendarEventCreate, CalendarEventUpdate
from app.db import SessionLocal
from app.main import app
from app.models.auth import Role, User
from app.security import get_password_hash
from app.services.validation import (
    days_in_month,
    is_leap_year,
    validate_calendar_date_string,
    validate_calendar_datetime,
)


MUST_ACCEPT = ["2026-01-01", "2026-01-31", "2026-02-28", "2024-02-29", "2026-09-15", "2026-12-31"]

MUST_REJECT = [
    "234098-01-10",   # 6-digit year
    "234543-12-10",   # 6-digit year
    "99999-01-01",    # 5-digit year
    "2026-13-10",     # month 13
    "2026-00-10",     # month 0
    "2026-02-30",     # February 30
    "2026-04-31",     # April 31
    "2026-06-31",     # June 31
    "2026-09-31",     # September 31
    "2026-11-31",     # November 31
    "2026-01-32",     # day 32
    "2026-01-00",     # day 0
    "2026-02-29",     # not a leap year
    "2026-1-1",       # month/day not 2 digits
    "2026-01-1",      # day not 2 digits
    "15-09-2026",     # wrong order
    "2026/09/15",     # wrong separator
    "2026-09-15x",    # trailing garbage
    "",               # empty
]


def _uniq(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def _delete_user(uid: int, email: str) -> None:
    """Delete the test user plus everything that references it."""
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


def _calendar_event_count() -> int:
    session = SessionLocal()
    total = session.execute(text("SELECT COUNT(*) FROM calendar_events")).scalar()
    session.close()
    return int(total or 0)


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    """A Super Admin user created directly in the DB, logged in via the API."""
    session = SessionLocal()
    email = _uniq("caladmin") + "@mail.example"
    role = session.query(Role).filter(Role.name == "Super Admin").first()
    if role is None:
        role = Role(name="Super Admin", description="Test super admin")
        session.add(role)
        session.flush()
    user = User(
        email=email, password_hash=get_password_hash("Str0ng!Pass9"),
        first_name="Cal", last_name="Admin", is_active=True, is_verified=True,
    )
    user.roles.append(role)
    session.add(user)
    session.commit()
    session.refresh(user)
    user_id = user.id
    session.close()

    r = client.post("/auth/login", json={"email": email, "password": "Str0ng!Pass9"})
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    yield {"email": email, "headers": headers, "id": user_id}
    _delete_user(user_id, email)


@pytest.fixture
def created_events(admin):
    """Track event ids so every test cleans up after itself."""
    ids = []
    yield ids
    session = SessionLocal()
    for event_id in ids:
        row = session.execute(
            text("SELECT id FROM calendar_events WHERE id = :i"), {"i": event_id}
        ).first()
        if row:
            session.execute(text("DELETE FROM calendar_events WHERE id = :i"), {"i": event_id})
    session.commit()
    session.close()


def _iso(date_key: str, time_part: str = "T10:00:00") -> str:
    return f"{date_key}{time_part}"


# ---------------------------------------------------------------- 1. date rules
class TestCalendarDateRules:
    def test_leap_year_and_month_lengths(self):
        assert is_leap_year(2024) and is_leap_year(2000)
        assert not is_leap_year(2026) and not is_leap_year(1900)
        assert days_in_month(2026, 1) == 31
        assert days_in_month(2026, 2) == 28
        assert days_in_month(2024, 2) == 29
        assert days_in_month(2026, 4) == 30
        assert days_in_month(2026, 6) == 30
        assert days_in_month(2026, 9) == 30
        assert days_in_month(2026, 11) == 30
        assert days_in_month(2026, 12) == 31

    @pytest.mark.parametrize("value", MUST_ACCEPT)
    def test_valid_dates_accepted(self, value):
        assert validate_calendar_date_string(value) == value
        assert validate_calendar_datetime(value) == value
        assert validate_calendar_datetime(_iso(value)).startswith(value)

    @pytest.mark.parametrize("value", MUST_REJECT)
    def test_invalid_dates_rejected(self, value):
        with pytest.raises(PydanticCustomError):
            validate_calendar_date_string(value)
        with pytest.raises(PydanticCustomError):
            validate_calendar_datetime(value)

    def test_invalid_time_rejected(self):
        for value in ["2026-09-15T24:00:00", "2026-09-15T10:60:00", "2026-09-15T10:00:99"]:
            with pytest.raises(PydanticCustomError):
                validate_calendar_datetime(value)

    def test_optional_fields_may_be_omitted(self):
        assert validate_calendar_datetime(None, required=False) is None
        with pytest.raises(PydanticCustomError):
            validate_calendar_datetime(None, required=True)
        with pytest.raises(PydanticCustomError):
            # A blank string is malformed input, never "no value".
            validate_calendar_datetime("   ", required=False)

    @pytest.mark.parametrize("value", MUST_REJECT)
    def test_event_schema_rejects_invalid_starts_at(self, value):
        with pytest.raises(ValidationError) as err:
            CalendarEventCreate(title="Bad date", starts_at=value)
        assert "valid calendar date" in str(err.value)

    @pytest.mark.parametrize("value", MUST_REJECT)
    def test_event_update_schema_rejects_invalid_dates(self, value):
        with pytest.raises(ValidationError):
            CalendarEventUpdate(starts_at=value)
        with pytest.raises(ValidationError):
            CalendarEventUpdate(ends_at=value)

    @pytest.mark.parametrize("value", MUST_ACCEPT)
    def test_event_schema_accepts_valid_dates(self, value):
        event = CalendarEventCreate(title="Good date", starts_at=value, ends_at=None)
        assert event.starts_at.strftime("%Y-%m-%d") == value

    def test_blank_title_rejected(self):
        with pytest.raises(ValidationError):
            CalendarEventCreate(title="   ", starts_at="2026-09-15")
# ---------------------------------------------------------------- 2. HTTP layer
class TestCalendarApiValidation:
    def test_invalid_dates_rejected_by_api(self, client, admin, created_events):
        before = _calendar_event_count()
        for value in MUST_REJECT:
            r = client.post(
                "/admin/calendar/",
                json={"title": "Invalid", "starts_at": value, "event_type": "MEETING"},
                headers=admin["headers"],
            )
            assert r.status_code in (400, 422), f"{value} was accepted: {r.text}"
            assert "valid calendar date" in r.text
        assert _calendar_event_count() == before, "invalid dates must never be persisted"

    def test_ends_before_starts_rejected_by_api(self, client, admin, created_events):
        r = client.post(
            "/admin/calendar/",
            json={
                "title": "Backwards",
                "starts_at": "2026-09-15T15:00:00",
                "ends_at": "2026-09-15T09:00:00",
                "event_type": "MEETING",
            },
            headers=admin["headers"],
        )
        assert r.status_code == 400, r.text

    def test_invalid_event_type_rejected_by_api(self, client, admin, created_events):
        r = client.post(
            "/admin/calendar/",
            json={"title": "Bad type", "starts_at": "2026-09-15T09:00:00", "event_type": "NOPE"},
            headers=admin["headers"],
        )
        assert r.status_code == 400, r.text

    def test_null_or_blank_start_date_is_rejected(self, client, admin, created_events):
        r = client.post("/admin/calendar/", json={"title": "No date"}, headers=admin["headers"])
        assert r.status_code in (400, 422), r.text
        r = client.post(
            "/admin/calendar/",
            json={"title": "Blank date", "starts_at": ""},
            headers=admin["headers"],
        )
        assert r.status_code in (400, 422), r.text


# ---------------------------------------------------------------- 3. CRUD flow
class TestCalendarEventCrud:
    def test_end_to_end_crud_roundtrip(self, client, admin, created_events):
        """create -> list -> get -> update -> list -> delete -> gone."""
        payload = {
            "title": "Research Review",
            "description": "Quarterly research review",
            "event_type": "MEETING",
            "starts_at": _iso("2026-09-15", "T10:00:00"),
            "ends_at": _iso("2026-09-15", "T11:00:00"),
            "all_day": False,
            "location": "Lab 2",
        }
        r = client.post("/admin/calendar/", json=payload, headers=admin["headers"])
        assert r.status_code == 201, r.text
        event = r.json()
        created_events.append(event["id"])
        assert event["title"] == "Research Review"
        assert event["starts_at"].startswith("2026-09-15T10:00:00")

        # The event is persisted and returned by the month-window query.
        r = client.get(
            "/admin/calendar/",
            params={"start": "2026-09-01T00:00:00", "end": "2026-09-30T23:59:59"},
            headers=admin["headers"],
        )
        assert r.status_code == 200, r.text
        assert event["id"] in [e["id"] for e in r.json()]

        # Read one.
        r = client.get(f"/admin/calendar/{event['id']}", headers=admin["headers"])
        assert r.status_code == 200 and r.json()["location"] == "Lab 2"

        # Update.
        r = client.patch(
            f"/admin/calendar/{event['id']}",
            json={
                "title": "Research Review (final)",
                "starts_at": _iso("2026-09-15", "T14:00:00"),
                "ends_at": _iso("2026-09-15", "T15:30:00"),
            },
            headers=admin["headers"],
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["title"] == "Research Review (final)"
        assert updated["starts_at"].startswith("2026-09-15T14:00:00")

        # Update is durable (fresh read from the database).
        r = client.get(f"/admin/calendar/{event['id']}", headers=admin["headers"])
        assert r.json()["title"] == "Research Review (final)"

        # Invalid update is rejected and does not change the row.
        r = client.patch(
            f"/admin/calendar/{event['id']}",
            json={"starts_at": "2026-02-30T09:00:00"},
            headers=admin["headers"],
        )
        assert r.status_code in (400, 422), r.text
        r = client.get(f"/admin/calendar/{event['id']}", headers=admin["headers"])
        assert r.json()["starts_at"].startswith("2026-09-15T14:00:00")

        # Delete.
        r = client.delete(f"/admin/calendar/{event['id']}", headers=admin["headers"])
        assert r.status_code == 200, r.text
        created_events.remove(event["id"])
        assert client.get(f"/admin/calendar/{event['id']}", headers=admin["headers"]).status_code == 404

        r = client.get(
            "/admin/calendar/",
            params={"start": "2026-09-01T00:00:00", "end": "2026-09-30T23:59:59"},
            headers=admin["headers"],
        )
        assert event["id"] not in [e["id"] for e in r.json()]

    def test_multiple_events_on_the_same_date(self, client, admin, created_events):
        ids = []
        for title in ("Morning standup", "Afternoon review"):
            r = client.post(
                "/admin/calendar/",
                json={"title": title, "starts_at": _iso("2026-10-05", "T09:00:00"), "event_type": "CALL"},
                headers=admin["headers"],
            )
            assert r.status_code == 201, r.text
            ids.append(r.json()["id"])
        created_events.extend(ids)

        r = client.get(
            "/admin/calendar/",
            params={"start": "2026-10-01T00:00:00", "end": "2026-10-31T23:59:59"},
            headers=admin["headers"],
        )
        assert r.status_code == 200
        same_day = [e for e in r.json() if e["id"] in ids]
        assert len(same_day) == 2

    def test_multi_day_event_overlapping_window_is_returned(self, client, admin, created_events):
        r = client.post(
            "/admin/calendar/",
            json={
                "title": "Sprint window",
                "starts_at": _iso("2026-08-28", "T09:00:00"),
                "ends_at": _iso("2026-09-02", "T18:00:00"),
                "event_type": "MILESTONE",
            },
            headers=admin["headers"],
        )
        assert r.status_code == 201, r.text
        event_id = r.json()["id"]
        created_events.append(event_id)

        r = client.get(
            "/admin/calendar/",
            params={"start": "2026-09-01T00:00:00", "end": "2026-09-30T23:59:59"},
            headers=admin["headers"],
        )
        assert event_id in [e["id"] for e in r.json()]

    def test_existing_endpoints_still_work(self, client, admin):
        """Regression: the pre-existing calendar endpoints keep working."""
        r = client.get("/admin/calendar/", headers=admin["headers"])
        assert r.status_code == 200 and isinstance(r.json(), list)

        r = client.get("/admin/calendar/", params={"event_type": "MEETING"}, headers=admin["headers"])
        assert r.status_code == 200 and isinstance(r.json(), list)

        r = client.get("/admin/calendar/999999999", headers=admin["headers"])
        assert r.status_code == 404

    def test_unauthenticated_access_still_blocked(self, client):
        assert client.get("/admin/calendar/").status_code in (401, 403)
