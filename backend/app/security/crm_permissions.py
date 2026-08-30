"""CRBAC permissions for PROJECT LABS Phase 2.

Extends Phase 1 permissions with CRM-specific permissions.
Follows the resource:action pattern: resource + . + action
"""

# CRM Permissions - Resource + Action pattern
CRM_PERMISSIONS = [
    # Lead permissions
    "leads.read",
    "leads.create",
    "leads.update",
    "leads.delete",
    "leads.assign",
    
    # Contact permissions
    "contacts.read",
    "contacts.create",
    "contacts.update",
    
    # Quote Request permissions
    "quote_requests.read",
    "quote_requests.create",
    "quote_requests.update",
    
    # Activity permissions
    "activities.read",
    "activities.create",
    
    # Follow-up permissions
    "followups.read",
    "followups.create",
    "followups.update",
    
    # Note permissions
    # Notes are lead-scoped; read/update via lead endpoints
    
    # Requirement question permissions
    "requirement_questions.read",
    "requirement_questions.create",
    "requirement_questions.update",
    
    # Project type permissions
    "project_types.read",
    "project_types.create",
    "project_types.update",
    
    # Project subcategory permissions
    "project_subcategories.read",
    "project_subcategories.create",
    "project_subcategories.update",
]


# Role-to-CRM-permission mapping
CRM_PERMISSIONS_BY_ROLE = {
    # Super Admin: Full access to all CRM permissions
    "Super Admin": CRM_PERMISSIONS,
    
    # Admin: Full CRM management
    "Admin": CRM_PERMISSIONS,
    
    # Project Manager: Lead and project-related access
    "Project Manager": [
        "leads.read",
        "leads.create",
        "leads.update",
        "leads.assign",
        "contacts.read",
        "quote_requests.read",
        "quote_requests.create",
        "quote_requests.update",
        "activities.read",
        "followups.read",
        "followups.create",
        "requirement_questions.read",
        "project_types.read",
        "project_subcategories.read",
    ],
    
    # R&D Manager: Research/experiment related (limited CRM access)
    "R&D Manager": [
        "leads.read",
        "activities.read",
    ],
    
    # Finance: Finance-relevant data only
    "Finance": [
        "leads.read",
        "quote_requests.read",
    ],
    
    # Content Manager: No CRM access by default
    "Content Manager": [],
    
    # Developer: No CRM access by default (project/task focused)
    "Developer": [],
    
    # User (standard registered user): Can view their own quote requests
    "User": [
        "leads.read",  # Limited - own leads only
        "quote_requests.read",  # Own quote requests
    ],
}


def get_permissions_for_role(role_name: str) -> List[str]:
    """Get permissions for a given role."""
    return CRM_PERMISSIONS_BY_ROLE.get(role_name, [])


def has_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific permission."""
    permissions = get_permissions_for_role(user_role)
    return permission in permissions