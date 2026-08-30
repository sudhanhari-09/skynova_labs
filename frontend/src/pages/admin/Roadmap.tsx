import React, { useCallback, useEffect, useState } from "react"
import { fetchRoadmapItems, createRoadmapItem, updateRoadmapItem, fetchProducts } from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const Roadmap: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: "", product_id: "", status: "BACKLOG", priority: "MEDIUM", category: "FEATURE", target_quarter: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [itemsData, productsData] = await Promise.all([fetchRoadmapItems(), fetchProducts(undefined, undefined, 1, 100)])
      setItems(itemsData || [])
      setProducts(productsData.products || [])
    } catch (e: any) {
      setError(e.message || "Failed to load roadmap")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setNotice("")
    try {
      await createRoadmapItem({
        title: form.title,
        product_id: form.product_id ? Number(form.product_id) : null,
        status: form.status,
        priority: form.priority,
        category: form.category,
        target_quarter: form.target_quarter || null,
      })
      setShowNew(false)
      setForm({ title: "", product_id: "", status: "BACKLOG", priority: "MEDIUM", category: "FEATURE", target_quarter: "" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create item")
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (id: number, status: string) => {
    try {
      await updateRoadmapItem(id, { status })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to update item")
    }
  }

  const groupByQuarter = (list: any[]) => {
    const map = new Map<string, any[]>()
    for (const it of list) {
      const key = it.target_quarter || "Unscheduled"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(it)
    }
    return Array.from(map.entries())
  }

  return (
    <main>
      <PageHeader
        title="Product Roadmap"
        subtitle={`${items.length} items`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New item"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create roadmap item</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-3">
              <label className="label" htmlFor="rm-title">Title *</label>
              <input id="rm-title" className="input input-bordered w-full" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rm-product">Product</label>
              <select id="rm-product" className="input input-bordered w-full" value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">—</option>
                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rm-q">Target quarter</label>
              <input id="rm-q" className="input input-bordered w-full" placeholder="e.g. 2026-Q3" value={form.target_quarter}
                onChange={(e) => setForm({ ...form, target_quarter: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rm-priority">Priority</label>
              <select id="rm-priority" className="input input-bordered w-full" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rm-cat">Category</label>
              <select id="rm-cat" className="input input-bordered w-full" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="FEATURE">FEATURE</option>
                <option value="IMPROVEMENT">IMPROVEMENT</option>
                <option value="RESEARCH">RESEARCH</option>
                <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
              </select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
            {saving ? "Creating…" : "Create item"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && <EmptyState title="No roadmap items" />}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-6">
          {groupByQuarter(items).map(([quarter, quarterItems]) => (
            <div key={quarter}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{quarter}</h3>
              <div className="space-y-2">
                {quarterItems.map((it: any) => (
                  <div key={it.id} className="card flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.product_name && <StatusBadge status={it.product_name} />}
                        <StatusBadge status={it.priority} />
                        <StatusBadge status={it.category} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 block mt-1">{it.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="input input-bordered w-40" value={it.status}
                        onChange={(e) => handleStatus(it.id, e.target.value)}>
                        <option value="BACKLOG">BACKLOG</option>
                        <option value="PLANNED">PLANNED</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default Roadmap