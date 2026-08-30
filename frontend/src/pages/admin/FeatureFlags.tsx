import React, { useCallback, useEffect, useState } from "react"
import { fetchFeatureFlags, toggleFeatureFlag, createFeatureFlag, deleteFeatureFlag } from "../../services/api"
import { PageHeader, Skeleton, StateError, EmptyState, Button, Alert } from "../../components/ui"

const FeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ key: "", label: "", description: "", scope: "ADMIN" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setFlags(await fetchFeatureFlags())
    } catch (e: any) {
      setError(e.message || "Failed to load feature flags")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (flag: any) => {
    try {
      await toggleFeatureFlag(flag.id)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to toggle flag")
    }
  }

  const handleCreate = async () => {
    if (!form.key.trim() || !form.label.trim()) return
    setSaving(true)
    setNotice("")
    try {
      await createFeatureFlag({
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description || undefined,
        scope: form.scope,
        is_enabled: false,
      })
      setShowNew(false)
      setForm({ key: "", label: "", description: "", scope: "ADMIN" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create flag")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this flag permanently? The module it guards will fall back to ENABLED.")) return
    try {
      await deleteFeatureFlag(id)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to delete flag")
    }
  }

  const enabledCount = flags.filter((f) => f.is_enabled).length

  return (
    <main>
      <PageHeader
        title="Feature Flags"
        subtitle={`${enabledCount} of ${flags.length} enabled — toggles apply instantly`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New flag"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create feature flag</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="ff-key">Key *</label>
              <input id="ff-key" className="input input-bordered w-full" placeholder="e.g. my_module" value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ff-label">Label *</label>
              <input id="ff-label" className="input input-bordered w-full" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ff-scope">Scope</label>
              <select id="ff-scope" className="input input-bordered w-full" value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                <option value="ADMIN">ADMIN</option>
                <option value="GLOBAL">GLOBAL</option>
                <option value="PUBLIC">PUBLIC</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="ff-desc">Description</label>
              <input id="ff-desc" className="input input-bordered w-full" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.key.trim() || !form.label.trim()}>
            {saving ? "Creating…" : "Create flag"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={6} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && flags.length === 0 && <EmptyState title="No feature flags" description="Create a flag to gate a module." />}
      {!loading && !error && flags.length > 0 && (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Flag</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {flags.map((f: any) => (
                <tr key={f.id} className="bg-white">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{f.label}</span>
                    {f.description && <span className="block text-xs text-gray-500">{f.description}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{f.key}</td>
                  <td className="px-4 py-3 text-gray-600">{f.scope}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${f.is_enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {f.is_enabled ? "ENABLED" : "DISABLED"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button className={f.is_enabled ? "btn-secondary" : ""} onClick={() => handleToggle(f)}>
                      {f.is_enabled ? "Disable" : "Enable"}
                    </Button>
                    <button type="button" className="btn-link text-red-600 ml-3" onClick={() => handleDelete(f.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default FeatureFlags