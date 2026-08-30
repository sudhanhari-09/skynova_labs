"""SkyNova Project Labs — backend API test suite.

Module-level smoke / contract tests against the live PostgreSQL-backed app:
  * health & metadata
  * full GET route sweep (no 5xx on any route with placeholder params)
  * auth lifecycle (register/login/me/refresh/wrong-password/lockout reset)
  * password-reset flow
  * admin CRUD create->update->delete for the Phase 3/4 modules
  * public read endpoints
  * public forms -> submissions -> convert -> lead pipeline

Run:  python -m pytest -q tests/  (from backend/)
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app
from app.models.auth import Role, User, UserRole
from app.security import get_password_hash


def _uniq(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def _delete_user(uid: int, email: str):
    """Delete a user plus everything that references it."""
    session = SessionLocal()
    for sql, params in [
        ("DELETE FROM notifications WHERE user_id = :u", {"u": uid}),
        ("DELETE FROM audit_logs WHERE user_id = :u", {"u": uid}),
        ("DELETE FROM token_sessions WHERE user_id = :u", {"u": uid}),
        ("DELETE FROM activities WHERE performed_by = :u", {"u": uid}),
        ("DELETE FROM inventory_movements WHERE created_by = :u", {"u": uid}),
        ("DELETE FROM login_attempts WHERE email = :e", {"e": email}),
        ("DELETE FROM page_sections WHERE page_id IN (SELECT id FROM pages WHERE created_by = :u)", {"u": uid}),
        ("DELETE FROM pages WHERE created_by = :u", {"u": uid}),
        ("DELETE FROM blog_posts WHERE author_id = :u", {"u": uid}),
        ("DELETE FROM experiments WHERE created_by = :u", {"u": uid}),
        ("DELETE FROM build_logs WHERE author_id = :u", {"u": uid}),
        ("DELETE FROM user_roles WHERE user_id = :u", {"u": uid}),
        ("DELETE FROM users WHERE id = :u", {"u": uid}),
    ]:
        session.execute(text(sql), params)
    session.commit()
    session.close()


def _leaf_routes():
    """Recursively unwrap custom _IncludedRouter lazy wrappers to real routes."""
    def walk(routes):
        for r in routes:
            if isinstance(r, TestClient):  # pragma: no cover
                continue
            inner = getattr(r, "original_router", None)
            if inner is not None and inner is not r:
                yield from walk(inner.routes)
            else:
                yield r
    return walk(app.routes)


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    """A Super Admin user created directly in the DB, logged in via the API."""
    session = SessionLocal()
    email = _uniq("admin") + "@mail.example"
    role = session.query(Role).filter(Role.name == "Super Admin").first()
    if role is None:
        role = Role(name="Super Admin", description="Test super admin")
        session.add(role)
        session.flush()
    user = User(
        email=email, password_hash=get_password_hash("Str0ng!Pass9"),
        first_name="Su", last_name="Per", is_active=True, is_verified=True,
    )
    user.roles.append(role)
    session.add(user)
    session.commit()
    session.refresh(user)
    user_id = user.id
    session.close()

    r = client.post("/auth/login", json={"email": email, "password": "Str0ng!Pass9"})
    assert r.status_code == 200, r.text
    tokens = r.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    yield {"email": email, "headers": headers, "id": user_id, "refresh": tokens["refresh_token"]}

    _delete_user(user_id, email)


def _h(admin):
    return admin["headers"]


# ---------------------------------------------------------------- 1. health/metadata
class TestHealth:
    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") in ("ok", "healthy")

    def test_root(self, client):
        assert client.get("/").status_code == 200

    def test_openapi_coverage(self, client):
        paths = client.get("/openapi.json").json()["paths"]
        assert len(paths) >= 200


# ---------------------------------------------------------------- 2. GET route sweep
class TestRouteSweep:
    def test_all_get_routes_have_no_500(self, client):
        bad = []
        checked = 0
        for route in _leaf_routes():
            methods = getattr(route, "methods", None) or set()
            if "GET" not in methods:
                continue
            path = route.path
            if path == "/" or path.startswith("/uploads"):
                continue
            for name in ("{id}", "{component_id}", "{projectId}", "{project_id}",
                         "{submissionId}", "{setting_id}", "{theme_id}"):
                path = path.replace(name, "1")
            path = path.replace("{slug}", "test").replace("{key}", "brand_name")
            path = path.replace("{public_key}", "testkey").replace("{secure_reference}", "TESTREF")
            path = path.replace("{reference}", "REF-0001").replace("{type}", "1")
            path = path.replace("{token}", "tok0001")
            path = __import__("re").sub(r"\{[^}]+\}", "1", path)
            r = client.get(path, follow_redirects=False)
            checked += 1
            if r.status_code >= 500:
                bad.append((path, r.status_code, r.text[:200]))
        assert checked >= 140, f"sweep only covered {checked} routes"
        assert bad == [], f"routes returning 5xx:\n{bad}"


# ---------------------------------------------------------------- 3. auth lifecycle
class TestAuth:
    def test_register_login_me_refresh_logout(self, client):
        email = _uniq("user") + "@mail.example"
        pw = "Str0ng!Pass9"
        r = client.post("/auth/register", json={
            "email": email, "password": pw, "first_name": "Te", "last_name": "St",
        })
        assert r.status_code == 201, r.text
        tokens = r.json()
        assert tokens.get("access_token") and tokens.get("refresh_token")

        h = {"Authorization": f"Bearer {tokens['access_token']}"}
        me = client.get("/auth/me", headers=h)
        assert me.status_code == 200, me.text
        assert me.json()["email"] == email

        refreshed = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert refreshed.status_code == 200, refreshed.text
        assert refreshed.json().get("access_token")

        out = client.post("/auth/logout", headers=h, json={"refresh_token": tokens["refresh_token"]})
        assert out.status_code in (200, 204), out.text

    def test_wrong_password_rejected(self, client):
        r = client.post("/auth/login", json={
            "email": _uniq("ghost") + "@mail.example", "password": "WrongPass!9",
        })
        assert r.status_code == 401

    def test_me_requires_auth(self, client):
        assert client.get("/auth/me").status_code == 401


# ---------------------------------------------------------------- 4. password reset
class TestPasswordReset:
    def test_reset_flow(self, client):
        session = SessionLocal()
        email = _uniq("reset") + "@mail.example"
        user = User(email=email, password_hash=get_password_hash("Old!Pass123"),
                    is_active=True, is_verified=True)
        session.add(user)
        session.commit()
        session.refresh(user)
        uid = user.id
        session.close()

        r = client.post("/auth/forgot-password", json={"email": email})
        assert r.status_code == 200, r.text

        from app.security import create_password_reset_token, hash_password_reset_token
        token = create_password_reset_token()
        session = SessionLocal()
        user = session.get(User, uid)
        user.password_reset_token_hash = hash_password_reset_token(token)
        user.password_reset_expires_at = __import__("datetime").datetime.utcnow() + __import__(
            "datetime").timedelta(minutes=30)
        session.commit()
        session.close()

        r = client.post("/auth/reset-password", json={
            "token": token, "new_password": "New!Pass456",
        })
        assert r.status_code == 200, r.text

        r = client.post("/auth/login", json={"email": email, "password": "New!Pass456"})
        assert r.status_code == 200, r.text

        _delete_user(uid, email)


# ---------------------------------------------------------------- 5. admin CRUD smoke
class TestAdminCrud:
    def test_services(self, client, admin):
        name = _uniq("Service-")
        r = client.post("/admin/services", headers=_h(admin), json={
            "name": name, "slug": name.lower(), "short_description": "s", "active": True,
        })
        assert r.status_code == 201, r.text
        sid = r.json()["id"]
        assert client.get("/admin/services", headers=_h(admin)).status_code == 200
        assert client.patch(f"/admin/services/{sid}", headers=_h(admin),
                            json={"name": name + "-x", "short_description": "updated"}).status_code == 200
        assert client.delete(f"/admin/services/{sid}", headers=_h(admin)).status_code in (200, 204)
        listing = client.get("/admin/services", headers=_h(admin)).json()
        assert sid not in [s["id"] for s in listing]

    def test_technologies_and_industries(self, client, admin):
        t = _uniq("Tech-")
        r = client.post("/admin/technologies", headers=_h(admin), json={
            "name": t, "slug": t.lower(), "description": "d", "active": True,
        })
        assert r.status_code == 201, r.text
        tid = r.json()["id"]
        i = _uniq("Ind-")
        r2 = client.post("/admin/industries", headers=_h(admin), json={
            "name": i, "slug": i.lower(), "description": "d", "active": True,
        })
        assert r2.status_code == 201, r2.text
        iid = r2.json()["id"]
        assert client.get("/admin/technologies", headers=_h(admin)).status_code == 200
        assert client.get("/admin/industries", headers=_h(admin)).status_code == 200
        assert client.delete(f"/admin/technologies/{tid}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/industries/{iid}", headers=_h(admin)).status_code in (200, 204)

    def test_site_content(self, client, admin):
        created = []
        q = _uniq("Question ")
        r = client.post("/admin/content/faqs", headers=_h(admin), json={"question": q, "answer": "a"})
        assert r.status_code == 201, r.text
        created.append((f"/admin/content/faqs/{r.json()['id']}", "faqs"))
        r = client.post("/admin/content/testimonials", headers=_h(admin),
                        json={"name": _uniq("T-"), "content": "c"})
        assert r.status_code == 201, r.text
        created.append((f"/admin/content/testimonials/{r.json()['id']}", "testimonials"))
        r = client.post("/admin/content/achievements", headers=_h(admin), json={"title": _uniq("A-")})
        assert r.status_code == 201, r.text
        created.append((f"/admin/content/achievements/{r.json()['id']}", "achievements"))
        for path, *_ in created:
            assert client.delete(path, headers=_h(admin)).status_code in (200, 204), path

    def test_rd_library(self, client, admin):
        for key, base in (("research", "/admin/research"), ("experiments", "/admin/experiments"),
                          ("build_logs", "/admin/build-logs")):
            if key == "build_logs":
                payload = {"title": _uniq(f"{key}-"), "entry_type": "progress",
                           "entry_date": "2026-08-01", "description": "d"}
            else:
                payload = {"title": _uniq(f"{key}-")}
            r = client.post(base, headers=_h(admin), json=payload)
            assert r.status_code == 201, f"{base}: {r.text}"
            rid = r.json()["id"]
            assert client.patch(f"{base}/{rid}", headers=_h(admin),
                                json={"title": _uniq(f"{key}-")}).status_code == 200
            assert client.delete(f"{base}/{rid}", headers=_h(admin)).status_code in (200, 204)

    def test_inventory(self, client, admin):
        r = client.post("/admin/inventory/suppliers", headers=_h(admin), json={"name": _uniq("S-")})
        assert r.status_code == 201, r.text
        r = client.post("/admin/inventory/components", headers=_h(admin),
                        json={"sku": _uniq("SKU-"), "name": _uniq("C-"), "category": "electronics"})
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        r = client.post("/inventory/movements", headers=_h(admin),
                        json={"component_id": cid, "movement_type": "STOCK_IN", "quantity": 5})
        assert r.status_code == 201, r.text
        assert client.patch(f"/admin/inventory/components/{cid}", headers=_h(admin),
                            json={"name": _uniq("C2-"), "sku": _uniq("SKU2-")}).status_code == 200
        assert client.get(f"/inventory/components/{cid}", headers=_h(admin)).status_code == 200
        session = SessionLocal()
        session.execute(text("DELETE FROM inventory_movements WHERE component_id = :c"), {"c": cid})
        session.commit()
        session.close()
        assert client.delete(f"/admin/inventory/components/{cid}", headers=_h(admin)).status_code in (200, 204)

    def test_website_settings_and_theme(self, client, admin):
        key = _uniq("test_")
        r = client.put(f"/admin/website/settings/{key}", headers=_h(admin),
                       json={"key": key, "value_type": "string", "value_text": "hello"})
        assert r.status_code == 200, r.text
        assert client.get("/admin/website/settings", headers=_h(admin)).status_code == 200
        assert client.delete(f"/admin/website/settings/{key}", headers=_h(admin)).status_code in (200, 204)

    def test_nav_item(self, client, admin):
        r = client.post("/admin/content/navigation", headers=_h(admin),
                        json={"label": _uniq("Nav "), "url": "/test", "location": "header",
                              "display_order": 99, "is_published": False})
        assert r.status_code == 201, r.text
        nid = r.json()["id"]
        assert client.delete(f"/admin/content/navigation/{nid}", headers=_h(admin)).status_code in (200, 204)

    def test_case_study_flow(self, client, admin):
        r = client.post("/admin/projects", headers=_h(admin), json={"title": _uniq("Raw-")})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        r = client.post("/admin/case-studies", headers=_h(admin), json={
            "project_id": pid, "title": _uniq("CS-"), "summary": "sum",
        })
        assert r.status_code == 201, r.text
        csid = r.json()["id"]
        assert client.get("/admin/case-studies", headers=_h(admin)).status_code == 200
        assert client.delete(f"/admin/case-studies/{csid}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/projects/{pid}", headers=_h(admin)).status_code in (200, 204)

    def test_top_level_tasks(self, client, admin):
        r = client.post("/admin/projects", headers=_h(admin), json={"title": _uniq("Tasks-")})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        r = client.post(f"/admin/projects/{pid}/tasks", headers=_h(admin),
                        json={"title": _uniq("Task "), "priority": "HIGH"})
        assert r.status_code == 201, r.text
        tid = r.json()["id"]
        r = client.get("/admin/tasks", headers=_h(admin))
        assert r.status_code == 200, r.text
        assert any(t["id"] == tid for t in r.json())
        r = client.patch(f"/admin/tasks/{tid}", headers=_h(admin), json={"status": "IN_PROGRESS"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "IN_PROGRESS"
        assert client.get(f"/admin/tasks/{tid}", headers=_h(admin)).json()["id"] == tid
        assert client.delete(f"/admin/tasks/{tid}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/projects/{pid}", headers=_h(admin)).status_code in (200, 204)


# ---------------------------------------------------------------- 6. public endpoints
class TestPublicEndpoints:
    @pytest.mark.parametrize("path", [
        "/public/site", "/navigation", "/services", "/technologies", "/industries",
        "/research", "/experiments", "/build-logs", "/content/faqs", "/content/testimonials",
        "/content/team", "/content/partners", "/content/achievements",
        "/case-studies", "/cms/blog", "/seo/snapshot",
    ])
    def test_public_get_200(self, client, path):
        r = client.get(path)
        assert r.status_code == 200, f"{path}: {r.status_code}"


# ---------------------------------------------------------------- 7. forms/CRM pipeline
class TestForms:
    def test_contact_to_submission_to_lead(self, client, admin):
        email = _uniq("c") + "@mail.example"
        r = client.post("/forms/contact", json={
            "name": _uniq("C-"), "email": email, "message": "Hello",
        })
        assert r.status_code == 200, r.text
        sub_id = r.json()["id"]

        r = client.post("/newsletter", json={"email": email})
        assert r.status_code == 200, r.text

        r = client.post("/forms/start-project", json={
            "name": "SP", "email": email, "idea": "An idea",
        })
        assert r.status_code == 200, r.text
        r = client.post("/forms/collaboration", json={
            "name": "Col", "email": email, "message": "msg",
        })
        assert r.status_code == 200, r.text

        subs = client.get("/admin/submissions", headers=_h(admin))
        assert subs.status_code == 200, subs.text
        rows = subs.json()
        assert len(rows) >= 3
        assert any(s["id"] == sub_id for s in rows if isinstance(s, dict))

        conv = client.post(f"/admin/submissions/{sub_id}/convert", headers=_h(admin))
        assert conv.status_code in (200, 201), conv.text
        assert conv.json().get("lead_id")
        leads = client.get("/admin/leads", headers=_h(admin))
        assert leads.status_code == 200, leads.text
        assert (leads.json() or [])


# ---------------------------------------------------------------- 8. roles & permissions RBAC
class TestRolesAndPermissions:
    def test_role_permission_workflow(self, client, admin):
        perms = client.get("/admin/users/permissions", headers=_h(admin))
        assert perms.status_code == 200, perms.text
        assert perms.json(), "permission catalog must be non-empty"

        r = client.post("/admin/users/roles", headers=_h(admin), json={"name": _uniq("R-"), "description": "test role"})
        assert r.status_code == 201, r.text
        rid = r.json()["id"]
        assert r.json()["permissions"] == []

        keys = [f"{p['resource']}:{p['action']}" for p in perms.json()[:3]]
        r = client.patch(f"/admin/users/roles/{rid}", headers=_h(admin),
                         json={"description": "updated", "permissions": keys})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["description"] == "updated"
        assert set(body["permissions"]) == set(keys)

        r = client.get("/admin/users/roles/all", headers=_h(admin))
        assert r.status_code == 200, r.text
        assert any(rr["id"] == rid and len(rr["permissions"]) == 3 for rr in r.json())

        assert client.patch("/admin/users/roles/999999", headers=_h(admin),
                            json={"description": "x"}).status_code == 404

        builtin = next(rr for rr in r.json() if rr["name"] in ("Super Admin", "Admin"))
        assert client.delete(f"/admin/users/roles/{builtin['id']}", headers=_h(admin)).status_code == 409

        assert client.delete(f"/admin/users/roles/{rid}", headers=_h(admin)).status_code == 204
        r = client.patch(f"/admin/users/roles/{rid}", headers=_h(admin), json={"description": "x"})
        assert r.status_code in (404, 422)


# ---------------------------------------------------------------- 9. CMS pages/sections/blog
class TestCms:
    def test_page_section_blog_workflow(self, client, admin):
        r = client.post("/admin/cms/pages", headers=_h(admin), json={
            "title": _uniq("Page "), "is_published": True, "content": "Hello body",
        })
        assert r.status_code == 201, r.text
        page = r.json()
        pid = page["id"]
        assert pid and page["is_published"] is True

        r = client.post(f"/admin/cms/pages/{pid}/sections", headers=_h(admin), json={
            "section_key": "hero", "title": "Hero", "content": "Hi", "is_enabled": True,
        })
        assert r.status_code == 201, r.text
        assert r.json()["id"] == pid
        sec_id = r.json()["sections"][0]["id"]

        r = client.patch(f"/admin/cms/sections/{sec_id}", headers=_h(admin),
                         json={"title": "Hero v2"})
        assert r.status_code == 200, r.text
        assert r.json()["sections"][0]["title"] == "Hero v2"

        r = client.patch(f"/admin/cms/pages/{pid}", headers=_h(admin),
                         json={"seo_title": "SEO T"})
        assert r.status_code == 200, r.text
        assert r.json()["seo_title"] == "SEO T"

        r = client.get("/admin/cms/pages", headers=_h(admin))
        assert r.status_code == 200, r.text
        assert any(p["id"] == pid for p in r.json())

        r = client.post("/admin/cms/blog", headers=_h(admin), json={
            "title": _uniq("Post "), "category": "News", "content": "Body", "is_published": True,
        })
        assert r.status_code == 201, r.text
        post_id = r.json()["id"]

        r = client.patch(f"/admin/cms/blog/{post_id}", headers=_h(admin),
                         json={"is_featured": True})
        assert r.status_code == 200, r.text
        assert r.json()["is_featured"] is True
        assert client.get("/cms/blog").status_code == 200

        assert client.delete(f"/admin/cms/blog/{post_id}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/cms/sections/{sec_id}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/cms/pages/{pid}", headers=_h(admin)).status_code in (200, 204)


# ---------------------------------------------------------------- 10. public detail routes
class TestPublicDetail:
    def test_blog_research_experiment_public_slugs(self, client, admin):
        r = client.post("/admin/cms/blog", headers=_h(admin), json={
            "title": _uniq("Pub "), "content": "c", "is_published": True,
        })
        assert r.status_code == 201, r.text
        blog_id = r.json()["id"]
        slug = r.json()["slug"]
        r = client.get(f"/cms/blog/{slug}")
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == slug
        assert client.get("/cms/blog/NOPE-" + _uniq("").lower()).status_code == 404

        r = client.post("/admin/research", headers=_h(admin), json={"title": _uniq("Pub "), "is_public": True})
        assert r.status_code == 201, r.text
        res_id = r.json()["id"]
        rslug = r.json()["slug"]
        assert client.get(f"/research/{rslug}").status_code == 200

        r = client.post("/admin/experiments", headers=_h(admin), json={"title": _uniq("Pub "), "is_public": True})
        assert r.status_code == 201, r.text
        exp_id = r.json()["id"]
        eslug = r.json()["slug"]
        assert client.get(f"/experiments/{eslug}").status_code == 200

        r = client.post("/admin/projects", headers=_h(admin), json={"title": _uniq("Pub ")})
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        ref = r.json()["project_number"]
        assert client.get("/public/projects/").status_code == 200
        assert client.get(f"/public/projects/{ref}").status_code == 200

        assert client.delete(f"/admin/cms/blog/{blog_id}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/research/{res_id}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/experiments/{exp_id}", headers=_h(admin)).status_code in (200, 204)
        assert client.delete(f"/admin/projects/{pid}", headers=_h(admin)).status_code in (200, 204)