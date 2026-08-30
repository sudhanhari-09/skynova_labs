import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchProjects, listContracts, listQuotations } from "../../services/api"

interface DashboardState {
  projects: number
  contracts: number
  quotations: number
  loading: boolean
  error: string | null
}

const Dashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    projects: 0,
    contracts: 0,
    quotations: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [projects, contracts, quotations] = await Promise.allSettled([
          fetchProjects(),
          listContracts(),
          listQuotations(),
        ])
        if (!active) return
        setState({
          projects: projects.status === "fulfilled" ? projects.value.projects.length : 0,
          contracts: contracts.status === "fulfilled" ? contracts.value.contracts.length : 0,
          quotations: quotations.status === "fulfilled" ? quotations.value.quotations.length : 0,
          loading: false,
          error: null,
        })
      } catch (e: any) {
        if (!active) return
        setState((s) => ({ ...s, loading: false, error: e.message || "Failed to load dashboard data" }))
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const quickLinks = [
    { to: "/admin/leads", title: "Leads", description: "Manage sales opportunities and project requests" },
    { to: "/admin/quote-requests", title: "Quote Requests", description: "Review incoming quote request submissions" },
    { to: "/admin/quotations", title: "Quotations", description: "Build and approve client quotations" },
    { to: "/admin/contracts", title: "Contracts", description: "Manage signed agreements and validities" },
    { to: "/admin/projects", title: "Projects", description: "Assign teams, milestones, tasks and updates" },
    { to: "/admin/projects/new", title: "+ New Project", description: "Start a new delivery project record" },
  ]

  const modules: { label: string; items: { to: string; title: string; description: string }[] }[] = [
    {
      label: "Sales",
      items: [
        { to: "/admin/quote-requests", title: "Quote Requests", description: "Review and update incoming requests" },
        { to: "/admin/project-types", title: "Project Types", description: "Manage the public catalogue of services" },
        { to: "/admin/requirement-questions", title: "Requirement Questions", description: "Define question sets per project type" },
      ],
    },
    {
      label: "Clients & Team",
      items: [
        { to: "/admin/clients", title: "Clients", description: "Directory of companies we work with" },
        { to: "/admin/team", title: "Team", description: "Internal staff and roles" },
      ],
    },
    {
      label: "Knowledge & Comms",
      items: [
        { to: "/admin/knowledge-base", title: "Knowledge Base", description: "Wiki, playbooks and documentation" },
        { to: "/admin/email-logs", title: "Email Logs", description: "Audit trail of email communications" },
        { to: "/admin/whatsapp-logs", title: "WhatsApp Logs", description: "Audit trail of WhatsApp messages" },
      ],
    },
    {
      label: "Overview & Product",
      items: [
        { to: "/admin/analytics", title: "Analytics", description: "Business metrics and insights" },
        { to: "/admin/products", title: "Products", description: "Product catalogue and versions" },
        { to: "/admin/roadmap", title: "Roadmap", description: "Upcoming work and priorities" },
        { to: "/admin/notifications", title: "Notifications", description: "Alerts and activity" },
      ],
    },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-gray-500 mt-1">
          High-level overview of active sales and delivery activity.
        </p>
      </header>

      {state.error && (
        <div className="alert alert-error mb-4">
          <span className="alert-text">{state.error} — check your connection.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-card__label">Projects</div>
          <div className="stat-card__value">{state.loading ? "…" : state.projects}</div>
          <Link to="/admin/projects" className="btn-link">View all →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Quotations</div>
          <div className="stat-card__value">{state.loading ? "…" : state.quotations}</div>
          <Link to="/admin/quotations" className="btn-link">View all →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Contracts</div>
          <div className="stat-card__value">{state.loading ? "…" : state.contracts}</div>
          <Link to="/admin/contracts" className="btn-link">View all →</Link>
        </div>
      </div>

      <section aria-label="Quick actions">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="dash-link-card">
              <span className="text-base font-semibold">{link.title}</span>
              <span className="text-sm text-gray-500">{link.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Modules" className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Modules</h2>
        <p className="text-sm text-gray-500 mb-4">
          Every area of Project Labs, grouped by function.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {modules.map((group) => (
            <div key={group.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{group.label}</h3>
              <div className="grid grid-cols-1 gap-2">
                {group.items.map((item) => (
                  <Link key={item.to} to={item.to} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{item.title}</span>
                      <span className="block text-xs text-gray-500">{item.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Dashboard