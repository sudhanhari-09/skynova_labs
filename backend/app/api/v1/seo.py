"""SEO endpoints: sitemap.xml, robots.txt and an SEO snapshot (spec §35)."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response, PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models.auth import Project
from app.models.spec import CMSPage, BlogPost, Service, ResearchProject, Experiment, CaseStudy


router = APIRouter()


BASE = (settings.frontend_url or "http://localhost:3000").rstrip("/")


@router.get("/seo/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    base = BASE
    urls = [f"{base}/"]
    seen_paths = {"/"}
    for p in db.query(Project).filter(Project.is_public_visible == True, Project.status.in_([  # noqa: E712
            "CONCEPT", "RESEARCH", "PLANNING", "PROTOTYPE", "DEVELOPMENT", "TESTING", "COMPLETED", "LIVE"])).all():
        path = f"/projects/{p.slug}" if p.slug else f"/projects/{p.id}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for s in db.query(Service).filter(Service.is_public == True).all():  # noqa: E712
        path = f"/services/{s.slug}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for b in db.query(BlogPost).filter(BlogPost.is_published == True).all():  # noqa: E712
        path = f"/cms/blog/{b.slug}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for r in db.query(ResearchProject).filter(ResearchProject.is_public == True).all():  # noqa: E712
        path = f"/research/{r.slug}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for e in db.query(Experiment).filter(Experiment.is_public == True).all():  # noqa: E712
        path = f"/experiments/{e.slug}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for c in db.query(CMSPage).filter(CMSPage.is_published == True).all():  # noqa: E712
        path = f"/pages/{c.slug}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")
    for cs in db.query(CaseStudy).filter(CaseStudy.is_published == True).all():  # noqa: E712
        path = f"/projects/{cs.project_id}"
        if path not in seen_paths:
            seen_paths.add(path)
            urls.append(f"{base}{path}")

    body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        body.append(f"  <url><loc>{u}</loc></url>")
    body.append("</urlset>")
    return Response(content="\n".join(body), media_type="application/xml")


@router.get("/seo/robots.txt", include_in_schema=False)
def robots():
    return PlainTextResponse(
        f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: {BASE}/seo/sitemap.xml\n"
    )


@router.get("/seo/snapshot")
def seo_snapshot(db: Session = Depends(get_db)):
    """Counts of indexable public content used by the SEO dashboard."""
    counts = {
        "projects": db.query(Project).filter(Project.is_public_visible == True).count(),  # noqa: E712
        "services": db.query(Service).filter(Service.is_public == True).count(),  # noqa: E712
        "blog_posts": db.query(BlogPost).filter(BlogPost.is_published == True).count(),  # noqa: E712
        "research": db.query(ResearchProject).filter(ResearchProject.is_public == True).count(),  # noqa: E712
        "experiments": db.query(Experiment).filter(Experiment.is_public == True).count(),  # noqa: E712
        "pages": db.query(CMSPage).filter(CMSPage.is_published == True).count(),  # noqa: E712
        "case_studies": db.query(CaseStudy).filter(CaseStudy.is_published == True).count(),  # noqa: E712
    }
    return {
        "base_url": BASE,
        "counts": counts,
        "total_indexable": sum(counts.values()),
    }