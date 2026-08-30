import React, { useCallback, useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { fetchPortalInvoice, payPortalInvoice } from "../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, Button, Alert } from "./../components/ui"

const ClientInvoicePortal: React.FC = () => {
  const { secureReference } = useParams<{ secureReference: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showPay, setShowPay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [amount, setAmount] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")

  const load = useCallback(async () => {
    if (!secureReference) return
    setLoading(true)
    setError("")
    try {
      const data = await fetchPortalInvoice(secureReference)
      setInvoice(data)
      setAmount(String(data.balance))
    } catch (e: any) {
      setError(e.message || "Invoice not found")
    } finally {
      setLoading(false)
    }
  }, [secureReference])

  useEffect(() => { load() }, [load])

  const fmtMoney = (v?: number, cur = "USD") =>
    `${cur} ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  const handlePay = async () => {
    const value = Number(amount)
    if (!value || value <= 0) return
    setSaving(true)
    setNotice("")
    try {
      const result = await payPortalInvoice(secureReference!, {
        amount: value,
        customer_name: customerName || undefined,
        customer_email: customerEmail || undefined,
        method: "ONLINE",
        metadata: { source: "client_portal" },
      })
      await load()
      setShowPay(false)
      setNotice(`Payment ${result.payment_number} recorded. Thank you!`)
    } catch (e: any) {
      setNotice(e.message || "Payment failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="site-main">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/" className="text-sm text-blue-600 mb-4 inline-block">← Back to home</Link>

        {loading && <div className="card"><Skeleton className="h-6 w-full" rows={6} /></div>}
        {!loading && error && <div className="card"><StateError message={error} onRetry={load} /></div>}

        {!loading && !error && invoice && (
          <>
            <PageHeader
              title={`${invoice.invoice_number} · ${invoice.title}`}
              subtitle="Secure invoice from Project Labs"
              actions={<StatusBadge status={invoice.status} />}
            />

            {notice && <div className="mb-4"><Alert variant={notice.includes("Thank you") ? "success" : "error"}>{notice}</Alert></div>}

            <div className="card mb-6">
              <dl className="def-list">
                <div><dt>Issued</dt><dd>{new Date(invoice.issue_date).toLocaleDateString()}</dd></div>
                <div><dt>Due</dt><dd>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}</dd></div>
                <div><dt>Total</dt><dd className="text-green-600">{fmtMoney(invoice.total, invoice.currency)}</dd></div>
                <div><dt>Balance</dt><dd className={invoice.balance > 0 ? "text-red-600" : "text-green-600"}>{fmtMoney(invoice.balance, invoice.currency)}</dd></div>
              </dl>
            </div>

            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">Line items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.items.map((it: any, idx: number) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-4 py-3 text-gray-900 font-medium">{it.name}</td>
                        <td className="px-4 py-3 text-gray-600">{it.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{fmtMoney(it.total, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={2} className="px-4 py-3 font-semibold text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtMoney(invoice.total, invoice.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {invoice.balance > 0 && invoice.status !== "CANCELLED" && !showPay && (
              <div className="text-right">
                <Button onClick={() => setShowPay(true)}>Pay now</Button>
              </div>
            )}

            {showPay && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Make a payment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="pay-name">Your name</label>
                    <input id="pay-name" className="input input-bordered w-full" value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label" htmlFor="pay-email">Email (for receipt)</label>
                    <input id="pay-email" type="email" className="input input-bordered w-full" value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="pay-amount">Amount</label>
                    <input id="pay-amount" type="number" min={0} className="input input-bordered w-full" value={amount}
                      onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handlePay} disabled={saving || !Number(amount)}>
                    {saving ? "Processing…" : `Pay ${fmtMoney(Number(amount), invoice.currency)}`}
                  </Button>
                  <button type="button" className="btn-link" onClick={() => setShowPay(false)}>Cancel</button>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Demo mode: this records the payment securely against your invoice. No card is charged in this environment.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ClientInvoicePortal