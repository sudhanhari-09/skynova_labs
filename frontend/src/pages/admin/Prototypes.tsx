import React, { useCallback, useEffect, useState } from "react"
import { fetchPrototypes, createPrototype, updatePrototype } from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const Prototypes: React.FC = () => {
  const [prototypes, setPrototypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", prototype_type: "SOFTWARE", status: "DRAFT", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setPrototypes(await fetchPrototypes())
    } catch (e: any) {
      setError(e.message || "Failed to load prototypes")
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
      await createPrototype({
        name: form.name,
        description: form.description || undefined,
        prototype_type: form.prototype_type,
        status: form.status,
        notes: form.notes || undefined,
      })
      setShowNew(false)
      setForm({ name: "", description: "", prototype_type: "SOFTWARE", status: "DRAFT", notes: "" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create prototype")
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (id: number, status: string) => {
    try {
      await updatePrototype(id, { status })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to update prototype")
    }
  }

  return (
    <main>
      <PageHeader
        title="Prototypes"
        subtitle={`${prototypes.length} prototype${prototypes.length === 1 ? "" : "s"}`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New prototype"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Register prototype</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="pt-name">Name *</label>
              <input id="pt-name" className="input input-bordered w-full" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="pt-type">Type</label>
              <select id="pt-type" className="input input-bordered w-full" value={form.prototype_type}
                onChange={(e) => setForm({ ...form, prototype_type: e.target.value })}>
                <option value="UI">UI</option>
                <option value="PHYSICAL">PHYSICAL</option>
                <option value="SOFTWARE">SOFTWARE</option>
                <option value="CONCEPT">CONCEPT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pt-status">Status</label>
              <select id="pt-status" className="input input-bordered w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="DRAFT">DRAFT</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="ITERATING">ITERATING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="pt-desc">Description</label>
              <textarea id="pt-desc" rows={2} className="input input-bordered w-full" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
            {saving ? "Creating…" : "Register prototype"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={4} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && prototypes.length === 0 && <EmptyState title="No prototypes" />}
      {!loading && !error && prototypes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prototypes.map((p: any) => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                    <StatusBadge status={p.prototype_type} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.product_name ? `Product: ${p.product_name}` : "No linked product"}
                    {p.project_name ? ` · Project: ${p.project_name}` : ""}
                  </p>
                </div>
                <select className="input input-bordered w-40" value={p.status}
                  onChange={(e) => handleStatus(p.id, e.target.value)}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="ITERATING">ITERATING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              {p.description && <p className="text-sm text-gray-600 mt-2">{p.description}</p>}
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="rounded-md w-full h-40 object-cover mt-3" />
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default Prototypes