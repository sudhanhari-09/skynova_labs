import React, { useEffect, useState } from "react"
import { Outlet, Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../store/authStore"
import { useFeatureFlags } from "../hooks/useFeatureFlags"
import NotificationBell from "../components/NotificationBell"
import CommandCenter from "../components/CommandCenter"
import Logo from "../components/Logo"
import ScrollRestoration from "../components/ScrollRestoration"
import { Search } from "../components/icons"

const navGroups: { label: string; items: { to: string; label: string; end?: boolean; feature?: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", end: true },
      { to: "/admin/analytics", label: "Analytics" },
      { to: "/admin/notifications", label: "Notifications", feature: "notifications" },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/admin/leads", label: "Leads" },
      { to: "/admin/quote-requests", label: "Quote Requests" },
      { to: "/admin/quotations", label: "Quotations" },
      { to: "/admin/contracts", label: "Contracts" },
    ],
  },
  {
    label: "Delivery",
    items: [{ to: "/admin/projects", label: "Projects" }],
  },
  {
    label: "Billing",
    items: [
      { to: "/admin/invoices", label: "Invoices", feature: "invoices" },
      { to: "/admin/payments", label: "Payments", feature: "payments" },
    ],
  },
  {
    label: "Support & Automation",
    items: [
      { to: "/admin/support", label: "Support Desk", feature: "support" },
      { to: "/admin/calendar", label: "Calendar", feature: "calendar" },
      { to: "/admin/automation", label: "Automation", feature: "automation" },
    ],
  },
  {
    label: "Product",
    items: [
      { to: "/admin/products", label: "Products", feature: "products" },
      { to: "/admin/releases", label: "Releases", feature: "releases" },
      { to: "/admin/roadmap", label: "Roadmap", feature: "roadmaps" },
      { to: "/admin/prototypes", label: "Prototypes", feature: "prototypes" },
    ],
  },
  {
    label: "Clients & Team",
    items: [
      { to: "/admin/clients", label: "Clients" },
      { to: "/admin/team", label: "Team" },
      { to: "/admin/roles", label: "Roles & Permissions" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/admin/project-types", label: "Project Types" },
      { to: "/admin/requirement-questions", label: "Requirement Questions" },
    ],
  },
  {
    label: "Knowledge & Comms",
    items: [
      { to: "/admin/knowledge-base", label: "Knowledge Base" },
      { to: "/admin/email-logs", label: "Email Logs" },
      { to: "/admin/whatsapp-logs", label: "WhatsApp Logs" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/feature-flags", label: "Feature Flags", feature: "feature_flags" },
      { to: "/admin/cms", label: "Content Management" },
    ],
  },
  {
    label: "Site & Operations",
    items: [
      { to: "/admin/website", label: "Website Settings" },
      { to: "/admin/catalog", label: "Catalog" },
      { to: "/admin/site-content", label: "Site Content" },
      { to: "/admin/case-studies", label: "Case Studies" },
      { to: "/admin/rd", label: "R&D Entries" },
      { to: "/admin/submissions", label: "Public Forms" },
      { to: "/admin/inventory", label: "Inventory" },
      { to: "/admin/seo", label: "SEO" },
      { to: "/admin/audit", label: "Audit Log" },
    ],
  },
]

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/analytics": "Analytics",
  "/admin/leads": "Leads",
  "/admin/quote-requests": "Quote Requests",
  "/admin/quotations": "Quotations",
  "/admin/contracts": "Contracts",
  "/admin/projects": "Projects",
  "/admin/projects/new": "New Project",
  "/admin/invoices": "Invoices",
  "/admin/payments": "Payments",
  "/admin/support": "Support Desk",
  "/admin/notifications": "Notifications",
  "/admin/calendar": "Calendar",
  "/admin/automation": "Automation",
  "/admin/products": "Products",
  "/admin/releases": "Releases",
  "/admin/roadmap": "Roadmap",
  "/admin/prototypes": "Prototypes",
  "/admin/feature-flags": "Feature Flags",
  "/admin/cms": "Content Management",
  "/admin/clients": "Clients",
  "/admin/team": "Team",
  "/admin/roles": "Roles & Permissions",
  "/admin/project-types": "Project Types",
  "/admin/requirement-questions": "Requirement Questions",
  "/admin/knowledge-base": "Knowledge Base",
  "/admin/email-logs": "Email Logs",
  "/admin/whatsapp-logs": "WhatsApp Logs",
  "/admin/website": "Website Settings",
  "/admin/catalog": "Catalog",
  "/admin/site-content": "Site Content",
  "/admin/case-studies": "Case Studies",
  "/admin/submissions": "Public Forms",
  "/admin/inventory": "Inventory",
  "/admin/seo": "SEO",
  "/admin/audit": "Audit Log",
  "/admin/rd": "R&D Entries",
}

const sortedPageTitles = Object.entries(pageTitles)
  .sort((a, b) => b[0].length - a[0].length)

function resolveTitle(pathname: string): string {
  for (const [path, title] of sortedPageTitles) {
    if (pathname === path) return title
    if (pathname.startsWith(path + "/")) {
      const remaining = pathname.slice(path.length + 1)
      if (!remaining.includes("/")) {
        if (/^\d+$/.test(remaining)) {
          return title.replace(/s$/, "") + " Details"
        }
        return title
      }
    }
  }
  return "Admin"
}

const ADMIN_EMAIL = "hariharasudhan.s@care.ac.in"

function getAdminEmail(user: any): string {
  // Prefer user.email from JWT/store; fall back to localStorage
  return user?.email || localStorage.getItem("user_email") || ""
}

const AdminLayout: React.FC = () => {
  const { isLoading, isAuthenticated, user, logout } = useAuth()
  const { isEnabled } = useFeatureFlags()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Loading…
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (getAdminEmail(user).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Navigate to="/user-panel" replace />
  }

  const title = resolveTitle(location.pathname)

  return (
    <div className="admin-shell">
      <ScrollRestoration />
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar__brand">
          <Link to="/admin">
            <Logo width={32} />
            Project Labs
          </Link>
        </div>
        <nav className="admin-sidebar__nav">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.feature || isEnabled(item.feature))
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label}>
                <p>{group.label}</p>
                {visibleItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="admin-sidebar__footer">
          <div className="text-xs font-medium text-white">
            {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.email}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{user?.role || "user"}</div>
        </div>
      </aside>

      <div className="admin-content">
        <div className="admin-topbar">
          <div className="admin-topbar__title">{title}</div>
          <div className="admin-topbar__actions">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-[10px] font-semibold text-gray-400 border border-gray-200 rounded px-1">Ctrl K</kbd>
            </button>
            <NotificationBell />
            <Link to="/" className="btn-secondary">
              View site
            </Link>
            <button type="button" className="btn-link" onClick={async () => { await logout(); navigate("/"); }}>
              Sign out
            </button>
          </div>
        </div>
        <div className="admin-content__body">
          <Outlet />
        </div>
      </div>
      <CommandCenter open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

export default AdminLayout