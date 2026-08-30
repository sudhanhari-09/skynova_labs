"""Phase 4 RBAC permissions for Project Management, Team, Tasks, and Milestones.

Extends Phase 1, Phase 2, and Phase 3 permissions.
Follows the resource:action pattern: resource + ":" + action
"""

# Phase 4 Specific Permissions
PHASE4_PERMISSIONS = [
    # Project permissions
    "projects.read",
    "projects.create",
    "projects.update",
    "projects.delete",
    "projects.assign_manager",
    "projects.change_status",

    # Project member permissions
    "project_members.read",
    "project_members.create",
    "project_members.update",
    "project_members.remove",

    # Milestone permissions
    "milestones.read",
    "milestones.create",
    "milestones.update",
    "milestones.change_status",

    # Task permissions
    "tasks.read",
    "tasks.create",
    "tasks.update",
    "tasks.delete",
    "tasks.assign",
    "tasks.change_status",

    # Project update (progress log) permissions
    "project_updates.read",
    "project_updates.create",
    "project_updates.update",

    # Project document permissions
    "project_documents.read",
    "project_documents.create",
    "project_documents.update",
    "project_documents.delete",
]

# Extended role-to-permission mapping (includes Phase 1 + 2 + 3 + 4 permissions)
PHASE4_PERMISSIONS_BY_ROLE = {
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
        # Phase 4 permissions
        "projects.read", "projects.create", "projects.update", "projects.delete", "projects.assign_manager", "projects.change_status",
        "project_members.read", "project_members.create", "project_members.update", "project_members.remove",
        "milestones.read", "milestones.create", "milestones.update", "milestones.change_status",
        "tasks.read", "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status",
        "project_updates.read", "project_updates.create", "project_updates.update",
        "project_documents.read", "project_documents.create", "project_documents.update", "project_documents.delete",
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
        # Phase 4
        "projects.read", "projects.create", "projects.update", "projects.delete", "projects.assign_manager", "projects.change_status",
        "project_members.read", "project_members.create", "project_members.update", "project_members.remove",
        "milestones.read", "milestones.create", "milestones.update", "milestones.change_status",
        "tasks.read", "tasks.create", "tasks.update", "tasks.delete", "tasks.assign", "tasks.change_status",
        "project_updates.read", "project_updates.create", "project_updates.update",
        "project_documents.read", "project_documents.create", "project_documents.update", "project_documents.delete",
    ],
    # Project Manager: Full project management access
    "Project Manager": [
        # Phase 1 (limited)
        "leads.read",
        # Phase 2
        "quote_requests.read",
        # Phase 3
        "technical_analysis.read", "technical_analysis.create", "technical_analysis.update",
        "estimations.read", "estimations.create", "estimations.update",
        "quotations.read", "quotations.create", "quotations.update",
        # Phase 4
        "projects.read", "projects.create", "projects.update", "projects.assign_manager", "projects.change_status",
        "project_members.read", "project_members.create", "project_members.update", "project_members.remove",
        "milestones.read", "milestones.create", "milestones.update", "milestones.change_status",
        "tasks.read", "tasks.create", "tasks.update", "tasks.assign", "tasks.change_status",
        "project_updates.read", "project_updates.create", "project_updates.update",
        "project_documents.read", "project_documents.create", "project_documents.update",
    ],
    # R&D Manager: Technical analysis where appropriate
    "R&D Manager": [
        "technical_analysis.read",
        "estimations.read",
        "projects.read",
        "milestones.read",
        "tasks.read",
        "project_updates.read",
    ],
    # Finance: Pricing/financial quotation access
    "Finance": [
        "quotations.read",
        "estimations.read",
        "projects.read",
        "project_updates.read",
    ],
    # Developer: Task-level access to projects they work on
    "Developer": [
        "projects.read",
        "milestones.read",
        "tasks.read",
        "tasks.update",
        "tasks.change_status",
        "project_updates.read",
        "project_updates.create",
    ],
    # Content Manager: No access by default
    "Content Manager": [],
    # User (standard registered user): Limited self-service
    "User": [
        # Can view their own quote requests
        "quote_requests.read",
        # Can view their own leads
        "leads.read",
    ],
}


def get_permissions_for_role(role_name: str) -> list:
    """Get all permissions (Phase 1 + 2 + 3 + 4) for a given role."""
    return PHASE4_PERMISSIONS_BY_ROLE.get(role_name, [])


def has_permission(role_name: str, permission: str) -> bool:
    """Check if a role has a specific Phase 4 permission."""
    all_permissions = get_permissions_for_role(role_name)
    return permission in all_permissions
