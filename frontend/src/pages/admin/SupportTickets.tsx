import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { fetchSupportTickets, createSupportTicket } from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const SupportTickets: React.FC = () => {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ subject: "", description: "", priority: "MEDIUM", category: "", contact_email: "" })

  const load = useCallback(async (p: number, st: string, pr: string) => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchSupportTickets(st || undefined, pr || undefined, p, 25)
      setTickets(data.tickets || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    load(1, statusFilter, priorityFilter)
  }, [statusFilter, priorityFilter, load])

  const handleCreate = async () => {
    if (!form.subject.trim()) return
    setSaving(true)
    setNotice("")
    try {
      const created = await createSupportTicket({
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        category: form.category || undefined,
        contact_email: form.contact_email || undefined,
      })
      setShowNew(false)
      setForm({ subject: "", description: "", priority: "MEDIUM", category: "", contact_email: "" })
      navigate(`/admin/support/${created.id}`)
    } catch (e: any) {
      setNotice(e.message || "Failed to create ticket")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main>
      <PageHeader
        title="Support Desk"
        subtitle={`${total} ticket${total === 1 ? "" : "s"}`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New ticket"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create support ticket</h3>
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="tk-subject">Subject *</label>
                <input id="tk-subject" className="input input-bordered w-full" value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="tk-priority">Priority</label>
                <select id="tk-priority" className="input input-bordered w-full" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tk-email">Contact email</label>
                <input id="tk-email" type="email" className="input input-bordered w-full" value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="tk-desc">Description</label>
              <textarea id="tk-desc" className="input input-bordered w-full" rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.subject.trim()}>
            {saving ? "Creating…" : "Create ticket"}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3">
        <select className="input input-bordered md:w-56" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="WAITING">WAITING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <select className="input input-bordered md:w-56" value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={() => load(page, statusFilter, priorityFilter)} />}
      {!loading && !error && total === 0 && <EmptyState title="No tickets found" />}
      {!loading && !error && total > 0 && (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tickets.map((t: any) => (
                <tr key={t.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.ticket_number}</td>
                  <td className="px-4 py-3 text-gray-700">{t.subject}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{t.contact_email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="btn-link mx-1" onClick={() => navigate(`/admin/support/${t.id}`)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mt-4">
        <span className="text-sm text-gray-500">Page {page}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1, statusFilter, priorityFilter) }}>Previous</button>
          <button type="button" className="btn-secondary" disabled={page * 25 >= total} onClick={() => { setPage(page + 1); load(page + 1, statusFilter, priorityFilter) }}>Next</button>
        </div>
      </div>
    </main>
  )
}

export default SupportTickets