import React, { useCallback, useEffect, useState } from "react"
import {
  fetchAutomationRules, fetchAutomationRuns, createAutomationRule,
  updateAutomationRule, deleteAutomationRule,
} from "../../services/api"
import { PageHeader, Skeleton, StateError, EmptyState, Button, Alert, StatusBadge } from "../../components/ui"

const TRIGGERS = [
  "NEW_LEAD", "QUOTATION_SENT", "CONTRACT_SENT", "CONTRACT_ACCEPTED",
  "INVOICE_SENT", "INVOICE_OVERDUE", "PAYMENT_RECEIVED", "SUPPORT_TICKET_CREATED",
]

const Automation: React.FC = () => {
  const [rules, setRules] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [runsTotal, setRunsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [view, setView] = useState<"rules" | "runs">("rules")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", trigger_event: "NEW_LEAD", template: "", channels: "email" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [rulesData, runsData] = await Promise.all([
        fetchAutomationRules(),
        fetchAutomationRuns(1, 25),
      ])
      setRules(rulesData || [])
      setRuns(runsData.runs || [])
      setRunsTotal(runsData.total || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load automation")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setNotice("")
    try {
      await createAutomationRule({
        name: form.name,
        trigger_event: form.trigger_event,
        action: { channels: [form.channels], template: form.template || undefined, recipients: [] },
      })
      setShowNew(false)
      setForm({ name: "", trigger_event: "NEW_LEAD", template: "", channels: "email" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create rule")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (rule: any) => {
    try {
      await updateAutomationRule(rule.id, { is_active: !rule.is_active })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to update rule")
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this rule?")) return
    try {
      await deleteAutomationRule(id)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to delete rule")
    }
  }

  return (
    <main>
      <PageHeader
        title="Workflow Automation"
        subtitle={`${rules.length} rules · ${runsTotal} executions`}
        actions={
          <>
            <Button className={view === "rules" ? "" : "btn-secondary"} onClick={() => setView("rules")}>Rules</Button>
            <Button className={view === "runs" ? "" : "btn-secondary"} onClick={() => setView("runs")}>Run history</Button>
            <Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New rule"}</Button>
          </>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create automation rule</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="au-name">Name *</label>
              <input id="au-name" className="input input-bordered w-full" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="au-trigger">Trigger event</label>
              <select id="au-trigger" className="input input-bordered w-full" value={form.trigger_event}
                onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}>
                {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="au-channel">Channel</label>
              <select id="au-channel" className="input input-bordered w-full" value={form.channels}
                onChange={(e) => setForm({ ...form, channels: e.target.value })}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="au-template">Template</label>
              <textarea id="au-template" rows={2} className="input input-bordered w-full" value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                placeholder="Use placeholders like {payment_number}, {amount}, {currency}…" />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
            {saving ? "Creating…" : "Create rule"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={load} />}

      {!loading && !error && view === "rules" && (
        <>
          {rules.length === 0 && <EmptyState title="No rules" description="Create your first automation rule." />}
          {rules.length > 0 && (
            <div className="space-y-2">
              {rules.map((rule: any) => (
                <div key={rule.id} className="card flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rule.is_active ? "ACTIVE" : "DRAFT"} />
                      <span className="text-sm font-semibold text-gray-900">{rule.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Trigger: {rule.trigger_event} · Channels: {(rule.action?.channels || []).join(", ") || "—"} ·
                      Runs: {rule.runs_count} · Last: {rule.last_run_status || "never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className={rule.is_active ? "btn-secondary" : ""} onClick={() => handleToggle(rule)}>
                      {rule.is_active ? "Pause" : "Activate"}
                    </Button>
                    <button type="button" className="btn-link text-red-600" onClick={() => handleDelete(rule.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !error && view === "runs" && (
        <>
          {runs.length === 0 && <EmptyState title="No runs yet" description="Executions appear when triggers fire." />}
          {runs.length > 0 && (
            <div className="overflow-x-auto rounded-lg shadow bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Rule</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Channels</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Run at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {runs.map((run: any) => (
                    <tr key={run.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{run.rule_name || `#${run.rule_id}`}</td>
                      <td className="px-4 py-3 text-gray-600">{run.trigger_event}</td>
                      <td className="px-4 py-3 text-gray-600">{run.channels?.join(", ") || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-3 text-gray-600">{new Date(run.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default Automation