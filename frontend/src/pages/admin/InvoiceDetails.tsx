import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {
  getInvoice, updateInvoice, sendInvoice, cancelInvoice,
  addInvoiceItem, removeInvoiceItem, createPayment, fetchPayments,
} from "../../services/api"
import {
  PageHeader, Skeleton, StateError, StatusBadge, Button, Alert, EmptyState,
} from "../../components/ui"

const InvoiceDetails: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const id = Number(invoiceId)

  const [invoice, setInvoice] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, unit_price: "", item_type: "Service", tax: 0 })
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER")
  const [paySaving, setPaySaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await getInvoice(id)
      setInvoice(data)
      const payData = await fetchPayments(id)
      setPayments(payData.payments || [])
      if (data.balance > 0) setPayAmount(String(data.balance))
    } catch (e: any) {
      setError(e.message || "Failed to load invoice")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const fmtMoney = (v?: number, cur = "USD") =>
    `${cur} ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  const handleItemAdd = async () => {
    if (!newItem.name.trim() || !Number(newItem.unit_price)) return
    try {
      await addInvoiceItem(id, {
        name: newItem.name,
        quantity: Number(newItem.quantity) || 1,
        unit_price: Number(newItem.unit_price),
        item_type: newItem.item_type,
        tax: Number(newItem.tax) || 0,
      })
      setNewItem({ name: "", quantity: 1, unit_price: "", item_type: "Service", tax: 0 })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to add item")
    }
  }

  const handleItemRemove = async (itemId: number) => {
    if (!window.confirm("Remove this line item?")) return
    try {
      await removeInvoiceItem(id, itemId)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to remove item")
    }
  }

  const handleSend = async () => {
    try {
      await sendInvoice(id)
      setNotice("Invoice sent")
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to send invoice")
    }
  }

  const handleCancel = async () => {
    if (!window.confirm("Cancel this invoice?")) return
    try {
      await cancelInvoice(id)
      setNotice("Invoice cancelled")
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to cancel invoice")
    }
  }

  const handleDueDate = async (dueDate: string) => {
    try {
      const updated = await updateInvoice(id, { due_date: dueDate || null })
      setInvoice(updated)
    } catch (e: any) {
      setNotice(e.message || "Failed to update due date")
    }
  }

  const handlePay = async () => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) return
    setPaySaving(true)
    setNotice("")
    try {
      await createPayment({
        invoice_id: id,
        amount,
        currency: invoice.currency,
        method: payMethod,
        status: "SUCCEEDED",
      })
      setPaySaving(false)
      await load()
      setNotice("Payment recorded")
    } catch (e: any) {
      setPaySaving(false)
      setNotice(e.message || "Failed to record payment")
    }
  }

  if (loading) return <PageSkeletonLite />
  if (error) return <StateError message={error} onRetry={load} />
  if (!invoice) return <EmptyState title="Invoice not found" />
  const portalUrl = `/invoice/${invoice.secure_reference}`

  return (
    <main>
      <PageHeader
        title={`${invoice.invoice_number} · ${invoice.title}`}
        subtitle={invoice.status}
        actions={
          <>
            <Link to="/admin/invoices" className="btn-secondary">Back</Link>
            <Link className="btn-secondary" to={portalUrl} target="_blank">Client portal</Link>
            {invoice.status === "DRAFT" && <Button onClick={handleSend}>Send</Button>}
            {(invoice.status === "DRAFT" || invoice.status === "SENT") && (
              <Button className="!bg-red-100 !text-red-800" onClick={handleCancel}>Cancel</Button>
            )}
          </>
        }
      />

      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Details</h3>
          <dl className="def-list">
            <div><dt>Status</dt><dd><StatusBadge status={invoice.status} /></dd></div>
            <div><dt>Issued</dt><dd>{new Date(invoice.issue_date).toLocaleDateString()}</dd></div>
            <div><dt>Due date</dt><dd>
              <input
                type="date"
                className="input input-bordered w-full"
                value={invoice.due_date ? invoice.due_date.slice(0, 10) : ""}
                onChange={(e) => handleDueDate(e.target.value)}
              />
            </dd></div>
            <div><dt>Currency</dt><dd>{invoice.currency}</dd></div>
            {invoice.contract_id && <div><dt>Contract</dt><dd><Link className="text-primary" to={`/admin/contracts/${invoice.contract_id}`}>#{invoice.contract_id}</Link></dd></div>}
            {invoice.project_id && <div><dt>Project</dt><dd><Link className="text-primary" to={`/admin/projects/${invoice.project_id}`}>#{invoice.project_id}</Link></dd></div>}
            <div><dt>Secure reference</dt><dd className="font-mono text-xs">{invoice.secure_reference}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Totals</h3>
          <dl className="def-list">
            <div><dt>Subtotal</dt><dd>{fmtMoney(invoice.subtotal, invoice.currency)}</dd></div>
            <div><dt>Discount ({invoice.discount_type})</dt><dd>{fmtMoney(invoice.discount, invoice.currency)}</dd></div>
            <div><dt>Tax</dt><dd>{fmtMoney(invoice.tax, invoice.currency)}</dd></div>
            <div><dt>Total</dt><dd className="text-green-600">{fmtMoney(invoice.total, invoice.currency)}</dd></div>
            <div><dt>Paid</dt><dd>{fmtMoney(invoice.amount_paid, invoice.currency)}</dd></div>
            <div><dt>Balance</dt><dd className={invoice.balance > 0 ? "text-red-600" : "text-green-600"}>{fmtMoney(invoice.balance, invoice.currency)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Line items</h3>
        {invoice.items.length === 0 && <p className="text-sm text-gray-500 mb-4">No line items yet.</p>}
        {invoice.items.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3 text-right">Unit price</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.items.map((it: any) => (
                  <tr key={it.id} className="bg-white">
                    <td className="px-4 py-3 text-gray-900 font-medium">{it.name}</td>
                    <td className="px-4 py-3 text-gray-600">{it.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtMoney(it.unit_price, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtMoney(it.tax, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmtMoney(it.total, invoice.currency)}</td>
                    <td className="px-4 py-3 text-right">
                      {invoice.status === "DRAFT" && (
                        <button type="button" className="btn-link text-red-600" onClick={() => handleItemRemove(it.id)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoice.status === "DRAFT" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="label" htmlFor="item-name">Item name</label>
              <input id="item-name" className="input input-bordered w-full" value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Development hours" />
            </div>
            <div>
              <label className="label" htmlFor="item-qty">Qty</label>
              <input id="item-qty" type="number" min={1} className="input input-bordered w-full" value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="item-price">Unit price</label>
              <input id="item-price" type="number" min={0} className="input input-bordered w-full" value={newItem.unit_price}
                onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} />
            </div>
            <Button onClick={handleItemAdd}>Add item</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Payments</h3>
          {payments.length === 0 && <p className="text-sm text-gray-500">No payments yet.</p>}
          {payments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((p: any) => (
                    <tr key={p.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.payment_number}</td>
                      <td className="px-4 py-3 text-gray-600">{p.method}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice.balance > 0 && invoice.status !== "CANCELLED" && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="label" htmlFor="pay-amount">Amount</label>
                <input id="pay-amount" type="number" min={0} className="input input-bordered w-full" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="pay-method">Method</label>
                <select id="pay-method" className="input input-bordered w-full" value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <Button onClick={handlePay} disabled={paySaving || !Number(payAmount)}>
                {paySaving ? "Recording…" : "Record payment"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

const PageSkeletonLite = () => (
  <div className="py-6">
    <Skeleton className="h-6 w-64" />
    <div className="mt-6"><Skeleton className="h-48 w-full" /></div>
  </div>
)

export default InvoiceDetails