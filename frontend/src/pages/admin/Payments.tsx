import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPayments, createPayment } from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, EmptyState, Button, Alert } from "../../components/ui"

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ invoice_id: "", amount: "", method: "BANK_TRANSFER", currency: "USD", status: "SUCCEEDED", customer_email: "" })

  const load = useCallback(async (p: number, st: string) => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchPayments(undefined, st || undefined, p, 25)
      setPayments(data.payments || [])
      setTotal(data.total || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load payments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    load(1, statusFilter)
  }, [statusFilter, load])

  const handleCreate = async () => {
    if (!Number(form.amount) || !Number(form.invoice_id)) return
    setSaving(true)
    setNotice("")
    try {
      await createPayment({
        invoice_id: Number(form.invoice_id),
        amount: Number(form.amount),
        currency: form.currency,
        method: form.method,
        status: form.status,
        customer_email: form.customer_email || undefined,
      })
      setShowNew(false)
      setForm({ invoice_id: "", amount: "", method: "BANK_TRANSFER", currency: "USD", status: "SUCCEEDED", customer_email: "" })
      await load(page, statusFilter)
    } catch (e: any) {
      setNotice(e.message || "Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  const fmtMoney = (v?: number, cur = "USD") =>
    `${cur} ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <main>
      <PageHeader
        title="Payments"
        subtitle={`${total} payment${total === 1 ? "" : "s"}`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "Record payment"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Record payment</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="pay-inv">Invoice ID *</label>
              <input id="pay-inv" type="number" className="input input-bordered w-full" value={form.invoice_id}
                onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="pay-amt">Amount *</label>
              <input id="pay-amt" type="number" min={0} className="input input-bordered w-full" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="pay-meth">Method</label>
              <select id="pay-meth" className="input input-bordered w-full" value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CARD">Card</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="ONLINE">Online</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay-status">Status</label>
              <select id="pay-status" className="input input-bordered w-full" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="SUCCEEDED">SUCCEEDED</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <select className="input input-bordered w-full md:w-64" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="SUCCEEDED">SUCCEEDED</option>
          <option value="FAILED">FAILED</option>
          <option value="REFUNDED">REFUNDED</option>
        </select>
      </div>

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={() => load(page, statusFilter)} />}
      {!loading && !error && total === 0 && <EmptyState title="No payments found" />}
      {!loading && !error && total > 0 && (
        <div className="overflow-x-auto rounded-lg shadow bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Paid at</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((p: any) => (
                <tr key={p.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.payment_number}</td>
                  <td className="px-4 py-3">
                    {p.invoice_id ? <Link className="text-primary" to={`/admin/invoices/${p.invoice_id}`}>{p.invoice_number || `#${p.invoice_id}`}</Link> : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.method}</td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmtMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mt-4">
        <span className="text-sm text-gray-500">Page {page}</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1, statusFilter) }}>Previous</button>
          <button type="button" className="btn-secondary" disabled={page * 25 >= total} onClick={() => { setPage(page + 1); load(page + 1, statusFilter) }}>Next</button>
        </div>
      </div>
    </main>
  )
}

export default Payments