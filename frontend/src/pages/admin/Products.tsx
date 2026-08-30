import React, { useCallback, useEffect, useState } from "react"
import {
  fetchProducts, createProduct, updateProduct,
  fetchProductVersions, createProductVersion,
} from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const Products: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", category: "", status: "CONCEPT", current_version: "" })
  const [versionsByProduct, setVersionsByProduct] = useState<Record<number, any[]>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [newVersion, setNewVersion] = useState<Record<number, { version: string; notes: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchProducts(undefined, undefined, 1, 100)
      setProducts(data.products || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadVersions = async (productId: number) => {
    try {
      const versions = await fetchProductVersions(productId)
      setVersionsByProduct((prev) => ({ ...prev, [productId]: versions }))
    } catch (e) {
      console.error(e)
    }
  }

  const toggleExpand = (productId: number) => {
    if (expanded === productId) {
      setExpanded(null)
    } else {
      setExpanded(productId)
      loadVersions(productId)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setNotice("")
    try {
      await createProduct({
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        status: form.status,
        current_version: form.current_version || undefined,
        platform: ["web"],
      })
      setShowNew(false)
      setForm({ name: "", description: "", category: "", status: "CONCEPT", current_version: "" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (productId: number, status: string) => {
    try {
      await updateProduct(productId, { status })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to update product")
    }
  }

  const handleVersion = async (productId: number) => {
    const draft = newVersion[productId] || { version: "", notes: "" }
    if (!draft.version.trim()) return
    try {
      await createProductVersion({ product_id: productId, version: draft.version, notes: draft.notes || undefined })
      setNewVersion((prev) => ({ ...prev, [productId]: { version: "", notes: "" } }))
      await loadVersions(productId)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to add version")
    }
  }

  const displayStatus = (s: string) =>
    s === "ACTIVE" ? "LAUNCHED" : s

  return (
    <main>
      <PageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? "" : "s"}`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New product"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create product</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="pd-name">Name *</label>
              <input id="pd-name" className="input input-bordered w-full" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="pd-cat">Category</label>
              <input id="pd-cat" className="input input-bordered w-full" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="pd-status">Status</label>
              <select id="pd-status" className="input input-bordered w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="CONCEPT">CONCEPT</option>
                <option value="IN_DEVELOPMENT">IN_DEVELOPMENT</option>
                <option value="BETA">BETA</option>
                <option value="LAUNCHED">LAUNCHED</option>
                <option value="SUNSET">SUNSET</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label" htmlFor="pd-desc">Description</label>
              <textarea id="pd-desc" rows={2} className="input input-bordered w-full" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
            {saving ? "Creating…" : "Create product"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && total === 0 && <EmptyState title="No products" description="Create your first product." />}
      {!loading && !error && total > 0 && (
        <div className="space-y-2">
          {products.map((p: any) => (
            <div key={p.id} className="card">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                    {p.current_version && <StatusBadge status={`v${p.current_version}`} />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.slug} · {p.category || "Uncategorized"}</p>
                  {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={displayStatus(p.status)} />
                  <span className="text-xs text-gray-500">{p.versions_count} versions · {p.releases_count} releases · {p.roadmap_items_count} roadmap</span>
                  <Button className="btn-secondary" onClick={() => toggleExpand(p.id)}>
                    {expanded === p.id ? "Hide versions" : "Versions"}
                  </Button>
                  <select className="input input-bordered w-40" value={p.status}
                    onChange={(e) => handleStatus(p.id, e.target.value)}>
                    <option value="CONCEPT">CONCEPT</option>
                    <option value="IN_DEVELOPMENT">IN_DEVELOPMENT</option>
                    <option value="BETA">BETA</option>
                    <option value="LAUNCHED">LAUNCHED</option>
                    <option value="SUNSET">SUNSET</option>
                  </select>
                </div>
              </div>

              {expanded === p.id && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Versions</h4>
                  {(versionsByProduct[p.id] || []).length === 0 && <p className="text-xs text-gray-500">No versions yet.</p>}
                  <div className="space-y-2 mb-3">
                    {(versionsByProduct[p.id] || []).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-md px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{v.version}</span>
                          {v.name && <span className="text-xs text-gray-500 ml-2">{v.name}</span>}
                          {v.notes && <p className="text-xs text-gray-500 mt-0.5">{v.notes}</p>}
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="input input-bordered w-40"
                      placeholder="e.g. 1.0.0"
                      value={(newVersion[p.id] || {}).version || ""}
                      onChange={(e) => setNewVersion((prev) => ({ ...prev, [p.id]: { ...prev[p.id], version: e.target.value } }))}
                    />
                    <Button className="btn-secondary" onClick={() => handleVersion(p.id)}>Add version</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default Products