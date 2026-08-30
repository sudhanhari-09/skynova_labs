# PROJECT LABS API v1 Package
#
# VERSIONING DISCIPLINE:
# This router provides /api/v1/health and /api/v1/status as the canonical
# versioned endpoints. Individual feature routers are registered directly
# on the app with their own prefixes (e.g., /admin/projects, /auth, /public/*).
# This is intentional: the existing prefix scheme is stable, tested, and
# consumed by the frontend. Future routers should consider /api/v1/{feature}
# if a full version migration is undertaken.
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["v1"])


@router.get("/health")
async def health(db=None):
    return {"status": "healthy", "service": "project-labs-api"}


@router.get("/status")
async def status():
    return {"status": "operational", "version": "2.0.0"}