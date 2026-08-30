from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api.v1 import router as v1_router
from app.api.v1.auth import router as auth_router
from app.api.v1.quote_requests import router as quote_requests_router
from app.api.v1.leads import router as leads_router
from app.api.v1.quotations import router as quotations_router
from app.api.v1.contracts import router as contracts_router
from app.api.v1.technical_analyses import router as technical_analyses_router
from app.api.v1.estimations import router as estimations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.public_projects import router as public_projects_router
from app.api.v1.project_types import router as project_types_router
from app.api.v1.requirement_questions import router as requirement_questions_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.payments import router as payments_router
from app.api.v1.support import router as support_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.automation import router as automation_router
from app.api.v1.products import router as products_router
from app.api.v1.releases import router as releases_router
from app.api.v1.roadmap import router as roadmap_router
from app.api.v1.prototypes import router as prototypes_router
from app.api.v1.feature_flags import admin_router as feature_flags_router
from app.api.v1.feature_flags import public_router as public_config_router
from app.api.v1.portal import router as portal_router
from app.api.v1.users import router as users_router
from app.api.v1.catalogs import router as catalogs_router
from app.api.v1.catalogs import audit_logs_router
from app.api.v1.clients import router as clients_router
from app.api.v1.services import router as services_router
from app.api.v1.services import admin_router as services_admin_router
from app.api.v1.technologies import router as technologies_router
from app.api.v1.technologies import admin_router as technologies_admin_router
from app.api.v1.industries import router as industries_router
from app.api.v1.industries import admin_router as industries_admin_router
from app.api.v1.cms import router as cms_router
from app.api.v1.cms import admin_router as cms_admin_router
from app.api.v1.cms import public_router as cms_public_router
from app.api.v1.content import router as content_router
from app.api.v1.content import nav_router as navigation_router
from app.api.v1.content import admin_router as content_admin_router
from app.api.v1.website import router as website_router
from app.api.v1.website import admin_router as website_admin_router
from app.api.v1.website import public_router as website_public_router
from app.api.v1.media import router as media_router
from app.api.v1.research import router as research_router
from app.api.v1.research import admin_router as research_admin_router
from app.api.v1.experiments import router as experiments_router
from app.api.v1.experiments import admin_router as experiments_admin_router
from app.api.v1.build_logs import router as build_logs_router
from app.api.v1.build_logs import admin_router as build_logs_admin_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.inventory import admin_router as inventory_admin_router
from app.api.v1.inventory import move_router as inventory_move_router
from app.api.v1.project_components import router as project_components_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.knowledge import admin_router as knowledge_admin_router
from app.api.v1.knowledge import public_router as knowledge_public_router
from app.api.v1.email import router as email_router
from app.api.v1.whatsapp import router as whatsapp_router
from app.api.v1.audit import router as audit_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.analytics import search_router as command_center_router
from app.api.v1.product_features import router as product_features_router
from app.api.v1.forms import router as forms_router
from app.api.v1.forms import news_router as newsletter_router
from app.api.v1.forms import admin_router as submissions_router
from app.api.v1.seo import router as seo_router
from app.api.v1.case_studies import router as case_studies_router
from app.api.v1.case_studies import admin_router as case_studies_admin_router
from app.api.v1.tasks import router as tasks_router

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=f"PROJECT LABS - Premium technology innovation R&D company platform (v{settings.app_version})"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins_str.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router)
app.include_router(auth_router)
app.include_router(quote_requests_router)
app.include_router(leads_router)
app.include_router(quotations_router)
app.include_router(contracts_router)
app.include_router(technical_analyses_router)
app.include_router(estimations_router)
app.include_router(projects_router)
app.include_router(public_projects_router)
app.include_router(project_types_router)
app.include_router(requirement_questions_router)
app.include_router(invoices_router)
app.include_router(payments_router)
app.include_router(support_router)
app.include_router(notifications_router)
app.include_router(calendar_router)
app.include_router(automation_router)
app.include_router(products_router)
app.include_router(releases_router)
app.include_router(roadmap_router)
app.include_router(prototypes_router)
app.include_router(feature_flags_router)
app.include_router(public_config_router)
app.include_router(portal_router)
app.include_router(users_router)
app.include_router(catalogs_router)
app.include_router(audit_logs_router)
app.include_router(clients_router)
app.include_router(services_router)
app.include_router(services_admin_router)
app.include_router(technologies_router)
app.include_router(technologies_admin_router)
app.include_router(industries_router)
app.include_router(industries_admin_router)
app.include_router(cms_router)
app.include_router(cms_admin_router)
app.include_router(cms_public_router)
app.include_router(content_router)
app.include_router(navigation_router)
app.include_router(content_admin_router)
app.include_router(website_router)
app.include_router(website_admin_router)
app.include_router(website_public_router)
app.include_router(media_router)
app.include_router(research_router)
app.include_router(research_admin_router)
app.include_router(experiments_router)
app.include_router(experiments_admin_router)
app.include_router(build_logs_router)
app.include_router(build_logs_admin_router)
app.include_router(inventory_router)
app.include_router(inventory_admin_router)
app.include_router(inventory_move_router)
app.include_router(project_components_router)
app.include_router(knowledge_router)
app.include_router(knowledge_admin_router)
app.include_router(knowledge_public_router)
app.include_router(email_router)
app.include_router(whatsapp_router)
app.include_router(audit_router)
app.include_router(analytics_router)
app.include_router(command_center_router)
app.include_router(product_features_router)
app.include_router(forms_router)
app.include_router(newsletter_router)
app.include_router(submissions_router)
app.include_router(seo_router)
app.include_router(case_studies_router)
app.include_router(case_studies_admin_router)
app.include_router(tasks_router)

uploads_dir = settings.storage_path if settings.storage_type == "local" else "storage/media"
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=uploads_dir), name="media")


@app.get("/")
async def root():
    return {
        "message": "Project Labs API",
        "version": settings.app_version,
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "project-labs-api"}