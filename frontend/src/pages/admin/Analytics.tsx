import React, { useCallback, useEffect, useState } from "react"
import {
  fetchAnalyticsDashboard,
  fetchAnalyticsFinancials,
  fetchAnalyticsProjects,
  fetchAnalyticsComms,
  AnalyticsDashboard,
  AnalyticsFinancials,
  AnalyticsProjects,
  AnalyticsComms,
} from "../../services/api"
import {
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Skeleton,
  StateError,
} from "../../components/ui"

const money = (v?: number | null) => (v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)

const DashboardView: React.FC<{ data: AnalyticsDashboard | null }> = ({ data }) => {
  if (!data) return <Skeleton className="h-64 w-full" />
  const kpi = (label: string, value: number | undefined) => (
    <div key={label} className="bg-white rounded-lg shadow p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value ?? "—"}</div>
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpi("Projects", data.counts.projects)}
        {kpi("Active", data.counts.active_projects)}
        {kpi("Quotations", data.counts.quotations)}
        {kpi("Contracts", data.counts.contracts)}
        {kpi("Leads", data.counts.leads)}
        {kpi("Clients", data.counts.clients)}
        {kpi("Invoices", data.counts.invoices)}
        {kpi("Pending invoices", data.counts.pending_invoices)}
        {kpi("Products", data.counts.products)}
        {kpi("Support tickets", data.counts.support_tickets)}
        {kpi("Tasks to do", data.counts.tasks_todo)}
        {kpi("Tasks in progress", data.counts.tasks_in_progress)}
        {kpi("Services", data.counts.services)}
        {kpi("Technologies", data.counts.technologies)}
        {kpi("Knowledge articles", data.counts.knowledge_articles)}
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold text-gray-900 mb-3">Revenue</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Total paid</div>
            <div className="text-2xl font-bold text-green-700">{money(data.revenue.total_paid)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Outstanding</div>
            <div className="text-2xl font-bold text-amber-700">{money(data.revenue.invoices_outstanding)}</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold text-gray-900 mb-3">People</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><div className="text-2xl font-bold">{data.people.users}</div><div className="text-sm text-gray-500">Users</div></div>
          <div><div className="text-2xl font-bold">{data.people.contacts}</div><div className="text-sm text-gray-500">Contacts</div></div>
          <div><div className="text-2xl font-bold">{data.people.team_members}</div><div className="text-sm text-gray-500">Team members</div></div>
        </div>
      </div>
    </div>
  )
}

const FinancialsView: React.FC<{ data: AnalyticsFinancials | null }> = ({ data }) => {
  if (!data) return <Skeleton className="h-64 w-full" />
  const s = data.summary
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Total invoiced</div><div className="text-2xl font-bold">{money(s.total_invoiced)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Total paid</div><div className="text-2xl font-bold text-green-700">{money(s.total_paid)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Amount due</div><div className="text-2xl font-bold text-amber-700">{money(s.amount_due)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Gross margin</div><div className="text-2xl font-bold">{money(s.gross_margin)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Accepted quotes</div><div className="text-xl font-bold">{money(s.accepted_quotations_value)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Project cost</div><div className="text-xl font-bold">{money(s.project_actual_cost)}</div></div>
        <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Project value</div><div className="text-xl font-bold">{money(s.project_selling_value)}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold">Invoices by status</div>
          <div className="p-5 flex flex-wrap gap-2">
            {Object.entries(data.invoices_by_status).map(([k, v]) => (
              <Badge key={k} className="bg-blue-100 text-blue-800">{k}: {v}</Badge>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold">Payments by method</div>
          <div className="p-5 flex flex-wrap gap-2">
            {Object.entries(data.payments_by_method).map(([k, v]) => (
              <Badge key={k} className="bg-gray-100 text-gray-800">{k}: {v}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const ProjectsView: React.FC<{ data: AnalyticsProjects | null }> = ({ data }) => {
  if (!data) return <Skeleton className="h-64 w-full" />
  const bars = (obj: Record<string, number>) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(obj).map(([k, v]) => (
        <Badge key={k} className="bg-blue-100 text-blue-800">{k}: {v}</Badge>
      ))}
    </div>
  )
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold mb-3">Projects by status</div>{bars(data.by_status)}
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold mb-3">Tasks by status</div>{bars(data.tasks_by_status)}
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold mb-3">Milestones</div>
        <div className="text-2xl font-bold">{data.milestones.completed} <span className="text-sm text-gray-500">/ {data.milestones.total} completed</span></div>
      </div>
      <div className="bg-white rounded-lg shadow p-5">
        <div className="font-semibold mb-3">Automation runs</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xl font-bold text-green-700">{data.automation_runs.success}</div><div className="text-xs text-gray-500">Success</div></div>
          <div><div className="text-xl font-bold text-red-700">{data.automation_runs.failed}</div><div className="text-xs text-gray-500">Failed</div></div>
          <div><div className="text-xl font-bold text-gray-500">{data.automation_runs.pending}</div><div className="text-xs text-gray-500">Pending</div></div>
        </div>
      </div>
    </div>
  )
}

const CommsView: React.FC<{ data: AnalyticsComms | null }> = ({ data }) => {
  if (!data) return <Skeleton className="h-64 w-full" />
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Emails (total)</div><div className="text-3xl font-bold">{data.emails.total}</div><div className="text-xs text-gray-400">sent {data.emails.sent} · simulated {data.emails.simulated}</div></div>
      <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">WhatsApp (total)</div><div className="text-3xl font-bold">{data.whatsapp.total}</div><div className="text-xs text-gray-400">sent {data.whatsapp.sent} · simulated {data.whatsapp.simulated}</div></div>
      <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Audit events</div><div className="text-3xl font-bold">{data.audit_events}</div></div>
      <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Pending automation events</div><div className="text-3xl font-bold">{data.automation_events_pending}</div></div>
      <div className="bg-white rounded-lg shadow p-5"><div className="text-sm text-gray-500">Calendar events</div><div className="text-3xl font-bold">{data.calendar_events}</div></div>
    </div>
  )
}

const Analytics: React.FC = () => {
  const [tab, setTab] = useState("dashboard")
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [financials, setFinancials] = useState<AnalyticsFinancials | null>(null)
  const [projects, setProjects] = useState<AnalyticsProjects | null>(null)
  const [comms, setComms] = useState<AnalyticsComms | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([
      fetchAnalyticsDashboard().catch(() => null),
      fetchAnalyticsFinancials().catch(() => null),
      fetchAnalyticsProjects().catch(() => null),
      fetchAnalyticsComms().catch(() => null),
    ]).then(([d, f, p, c]) => {
      setDashboard(d)
      setFinancials(f)
      setProjects(p)
      setComms(c)
    }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Analytics" subtitle="Business metrics and insights computed live from the database." />
        {error && <StateError message={error} onRetry={load} />}
        <Tabs className="mb-6">
          <TabsList>
            <TabsTrigger active={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</TabsTrigger>
            <TabsTrigger active={tab === "financials"} onClick={() => setTab("financials")}>Financials</TabsTrigger>
            <TabsTrigger active={tab === "projects"} onClick={() => setTab("projects")}>Projects</TabsTrigger>
            <TabsTrigger active={tab === "comms"} onClick={() => setTab("comms")}>Communications</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mb-6">
          <button onClick={load} className="btn btn-outline btn-sm">Refresh</button>
        </div>
        <TabsContent active={tab === "dashboard"}><DashboardView data={dashboard} /></TabsContent>
        <TabsContent active={tab === "financials"}><FinancialsView data={financials} /></TabsContent>
        <TabsContent active={tab === "projects"}><ProjectsView data={projects} /></TabsContent>
        <TabsContent active={tab === "comms"}><CommsView data={comms} /></TabsContent>
      </div>
    </main>
  )
}

export default Analytics