import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  fetchInvoices,
  createInvoice,
  sendInvoice,
  cancelInvoice,
} from "../../services/api"
import {
  PageHeader, Skeleton, StateError, StatusBadge, EmptyState,
  Button, Alert,
} from "../../components/ui"

const Invoices: React.FC = () => {
  const navigate = useNavigate()
  const { status } = useParams<{ status: string }>()
  const [invoices, setInvoices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState(status || "")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState("")
  const [saving, setSaving] = useState(false)
  const [newInvoice, setNewInvoice] = useState({ title: "", contract_id: "", currency: "USD" })

  const load = useCallback(async (pageNum: number, statusFilter: string) => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchInvoices(statusFilter || undefined, pageNum, 25)
      setInvoices(data.invoices || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    load(1, filter)
  }, [filter, load])

  const handleCreate = async () => {
    if (!newInvoice.title.trim()) return
    setSaving(true)
    setCreateError("")
    try {
      const created = await createInvoice({
        title: newInvoice.title,
        contract_id: newInvoice.contract_id ? Number(newInvoice.contract_id) : undefined,
        currency: newInvoice.currency,
        items: [],
      })
      setShowCreate(false)
      setNewInvoice({ title: "", contract_id: "", currency: "USD" })
      navigate(`/admin/invoices/${created.id}`)
    } catch (e: any) {
      setCreateError(e.message || "Failed to create invoice")
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async (id: number) => {
    try {
      await sendInvoice(id)
      load(page, filter)
    } catch (e: any) {
      setError(e.message || "Failed to send invoice")
    }
  }

  const handleCancel = async (id: number) => {
    if (!window.confirm("Cancel this invoice?")) return
    try {
      await cancelInvoice(id)
      load(page, filter)
    } catch (e: any) {
      setError(e.message || "Failed to cancel invoice")
    }
  }

  const fmtMoney = (v?: number, cur = "USD") =>
    `${cur} ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <main>
      <PageHeader
        title="Invoices"
        subtitle={`${total} invoice${total === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Close" : "New invoice"}
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {showCreate && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create invoice</h3>
          {createError && <Alert variant="error">{createError}</Alert>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="inv-title">Title *</label>
              <input
                id="inv-title"
                className="input input-bordered w-full"
                value={newInvoice.title}
                onChange={(e) => setNewInvoice({ ...newInvoice, title: e.target.value })}
                placeholder="e.g. Phase 2 – Mobile App Development"
              />
            </div>
            <div>
              <label className="label" htmlFor="inv-contract">Contract ID</label>
              <input
                id="inv-contract"
                className="input input-bordered w-full"
                value={newInvoice.contract_id}
                onChange={(e) => setNewInvoice({ ...newInvoice, contract_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label" htmlFor="inv-cur">Currency</label>
              <select
                id="inv-cur"
                className="input input-bordered w-full"
                value={newInvoice.currency}
                onChange={(e) => setNewInvoice({ ...newInvoice, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AED">AED</option>
                <option value="PKR">PKR</option>
              </select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !newInvoice.title.trim()}>
            {saving ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <select
          className="input input-bordered w-full md:w-64"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
          <option value="PAID">PAID</option>
          <option value="OVERDUE">OVERDUE</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {loading && <Skeleton className="h-6 w-full" rows={6} />}
      {!loading && error && <StateError message={error} onRetry={() => load(page, filter)} />}
      {!loading && !error && total === 0 && (
        <EmptyState title="No invoices found" description="Create an invoice or adjust the filter." />
      )}
      {!loading && !error && total > 0 && (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmtMoney(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(inv.balance, inv.currency)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" className="btn-link mx-1" onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                      View
                    </button>
                    {inv.status === "DRAFT" && (
                      <button type="button" className="btn-link mx-1" onClick={() => handleSend(inv.id)}>
                        Send
                      </button>
                    )}
                    {(inv.status === "DRAFT" || inv.status === "SENT") && (
                      <button type="button" className="btn-link mx-1 text-red-600" onClick={() => handleCancel(inv.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationShim page={page} pageSize={25} total={total} onPageChange={(p: number) => { setPage(p); load(p, filter) }} />
    </main>
  )
}

const PaginationShim = React.memo(({ page, pageSize, total, onPageChange }: any) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
})

export default Invoices