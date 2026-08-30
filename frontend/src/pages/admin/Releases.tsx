import React, { useCallback, useEffect, useState } from "react"
import {
  fetchReleases, createRelease, updateRelease,
  markReleaseReleased, rollbackRelease, fetchProducts,
} from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const Releases: React.FC = () => {
  const [releases, setReleases] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ product_id: "", name: "", environment: "PRODUCTION", scheduled_for: "", release_notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [releasesData, productsData] = await Promise.all([fetchReleases(), fetchProducts(undefined, undefined, 1, 100)])
      setReleases(releasesData || [])
      setProducts(productsData.products || [])
    } catch (e: any) {
      setError(e.message || "Failed to load releases")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.product_id) return
    setSaving(true)
    setNotice("")
    try {
      await createRelease({
        product_id: Number(form.product_id),
        name: form.name,
        environment: form.environment,
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
        release_notes: form.release_notes || undefined,
      })
      setShowNew(false)
      setForm({ product_id: "", name: "", environment: "PRODUCTION", scheduled_for: "", release_notes: "" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create release")
    } finally {
      setSaving(false)
    }
  }

  const handleAction = async (id: number, action: "release" | "rollback" | "failure") => {
    try {
      if (action === "release") await markReleaseReleased(id)
      else if (action === "rollback") await rollbackRelease(id)
      else await updateRelease(id, { status: "ROLLED_BACK" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to update release")
    }
  }

  return (
    <main>
      <PageHeader
        title="Release Management"
        subtitle={`${releases.length} releases`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New release"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Schedule release</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="rl-product">Product *</label>
              <select id="rl-product" className="input input-bordered w-full" value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Select product</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rl-name">Name *</label>
              <input id="rl-name" className="input input-bordered w-full" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rl-env">Environment</label>
              <select id="rl-env" className="input input-bordered w-full" value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="STAGING">STAGING</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rl-when">Scheduled for</label>
              <input id="rl-when" type="datetime-local" className="input input-bordered w-full" value={form.scheduled_for}
                onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="rl-notes">Release notes</label>
              <input id="rl-notes" className="input input-bordered w-full" value={form.release_notes}
                onChange={(e) => setForm({ ...form, release_notes: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim() || !form.product_id}>
            {saving ? "Scheduling…" : "Schedule release"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={4} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && releases.length === 0 && <EmptyState title="No releases" description="Schedule your first release." />}
      {!loading && !error && releases.length > 0 && (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Release</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {releases.map((r: any) => (
                <tr key={r.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.product_name || `#${r.product_id}`}</td>
                  <td className="px-4 py-3 text-gray-600">{r.version_version || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.environment}</td>
                  <td className="px-4 py-3 text-gray-600">{r.scheduled_for ? new Date(r.scheduled_for).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "SCHEDULED" && (
                      <button type="button" className="btn-link mx-1" onClick={() => handleAction(r.id, "release")}>Release now</button>
                    )}
                    {r.status === "RELEASED" && (
                      <button type="button" className="btn-link text-red-600 mx-1" onClick={() => handleAction(r.id, "rollback")}>Rollback</button>
                    )}
                    {r.release_notes && <span className="text-xs text-gray-500">{r.release_notes}</span>}
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

export default Releases