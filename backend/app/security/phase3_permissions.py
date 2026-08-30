"""Phase 3 RBAC permissions for Technical Analysis, Estimation, Quotation, and Contract management.

Extends Phase 1 and Phase 2 permissions.
Follows the resource:action pattern: resource + ":" + action
"""

# Phase 3 Specific Permissions
PHASE3_PERMISSIONS = [
    # Technical Analysis permissions
    "technical_analysis.read",
    "technical_analysis.create",
    "technical_analysis.update",
    "technical_analysis.approve",

    # Estimation permissions
    "estimations.read",
    "estimations.create",
    "estimations.update",
    "estimations.approve",

    # Quotation permissions
    "quotations.read",
    "quotations.create",
    "quotations.update",
    "quotations.approve",
    "quotations.send",
    "quotations.accept",
    "quotations.reject",

    # Contract permissions
    "contracts.read",
    "contracts.create",
    "contracts.update",
    "contracts.approve",
    "contracts.send",
    "contracts.accept",
]

# Extended role-to-permission mapping (includes Phase 1 + 2 + 3 permissions)
PHASE3_PERMISSIONS_BY_ROLE = {
    # Super Admin: Full access to everything
    "Super Admin": [
        # Phase 1 permissions
        "users.read", "users.create", "users.update",
        "roles.read", "roles.create", "roles.update",
        "permissions.read",
        # Phase 2 permissions
        "leads.read", "leads.create", "leads.update", "leads.delete", "leads.assign",
        "contacts.read", "contacts.create", "contacts.update",
        "quote_requests.read", "quote_requests.create", "quote_requests.update",
        "activities.read", "activities.create",
        "followups.read", "followups.create", "followups.update",
        "project_types.read", "project_types.create", "project_types.update",
        "project_subcategories.read", "project_subcategories.create", "project_subcategories.update",
        "requirement_questions.read", "requirement_questions.create", "requirement_questions.update",
        # Phase 3 permissions
        "technical_analysis.read", "technical_analysis.create", "technical_analysis.update", "technical_analysis.approve",
        "estimations.read", "estimations.create", "estimations.update", "estimations.approve",
        "quotations.read", "quotations.create", "quotations.update", "quotations.approve", "quotations.send", "quotations.accept", "quotations.reject",
        "contracts.read", "contracts.create", "contracts.update", "contracts.approve", "contracts.send", "contracts.accept",
    ],
    # Admin: Full business management access
    "Admin": [
        # Phase 1
        "users.read", "users.update",
        # Phase 2
        "leads.read", "leads.create", "leads.update", "leads.assign",
        "contacts.read", "contacts.create", "contacts.update",
        "quote_requests.read", "quote_requests.create", "quote_requests.update",
        "activities.read", "activities.create",
        "followups.read", "followups.create", "followups.update",
        "project_types.read", "project_types.create", "project_types.update",
        "project_subcategories.read", "project_subcategories.create", "project_subcategories.update",
        "requirement_questions.read", "requirement_questions.create", "requirement_questions.update",
        # Phase 3
        "technical_analysis.read", "technical_analysis.create", "technical_analysis.update", "technical_analysis.approve",
        "estimations.read", "estimations.create", "estimations.update", "estimations.approve",
        "quotations.read", "quotations.create", "quotations.update", "quotations.approve", "quotations.send", "quotations.accept", "quotations.reject",
        "contracts.read", "contracts.create", "contracts.update", "contracts.approve", "contracts.send", "contracts.accept",
    ],
    # Project Manager: Technical analysis, estimation and quotation preparation
    "Project Manager": [
        # Phase 1 (limited)
        "leads.read",
        # Phase 2
        "quote_requests.read",
        # Phase 3
        "technical_analysis.read", "technical_analysis.create", "technical_analysis.update",
        "estimations.read", "estimations.create", "estimations.update",
        "quotations.read", "quotations.create", "quotations.update",
    ],
    # R&D Manager: Technical analysis where appropriate
    "R&D Manager": [
        "technical_analysis.read",
        "estimations.read",
    ],
    # Finance: Pricing/financial quotation access
    "Finance": [
        "quotations.read",
        "estimations.read",
    ],
    # Content Manager: No access by default
    "Content Manager": [],
    # Developer: No quotation financial access by default
    "Developer": [],
    # User (standard registered user): Limited self-service
    "User": [
        # Can view their own quote requests
        "quote_requests.read",
        # Can view their own leads
        "leads.read",
    ],
}


def get_permissions_for_role(role_name: str) -> list:
    """Get all permissions (Phase 1 + 2 + 3) for a given role."""
    return PHASE3_PERMISSIONS_BY_ROLE.get(role_name, [])


def has_permission(role_name: str, permission: str) -> bool:
    """Check if a role has a specific Phase 3 permission."""
    # Also check base permissions from earlier phases
    all_permissions = get_permissions_for_role(role_name)
    return permission in all_permissions