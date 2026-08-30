import React, { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { getQuotation, Quotation } from "../../services/api"
import { Spinner } from "../../components/ui"

const statusClass: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  INTERNAL_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  SENT: "bg-primary-100 text-primary-800",
  VIEWED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

const QuotationDetails: React.FC = () => {
  const { quotationId } = useParams<{ quotationId: string }>()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const id = Number(quotationId)
      if (!id) {
        setError("Invalid quotation identifier.")
        setLoading(false)
        return
      }
      try {
        const data = await getQuotation(id)
        if (!active) return
        setQuotation(data)
      } catch (e: any) {
        if (!active) return
        setError(e.message || "Failed to load quotation.")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [quotationId])

  if (loading) {
    return (
      <div className="py-16">
        <Spinner className="mx-auto" />
      </div>
    )
  }

  if (error || !quotation) {
    return (
      <div className="bg-white rounded-lg shadow p-10 text-center">
        <div className="alert alert-error">
          <span className="alert-text">{error || "Quotation not found."}</span>
        </div>
        <button type="button" className="btn-secondary mt-4" onClick={() => navigate("/admin/quotations")}>
          Back to quotations
        </button>
      </div>
    )
  }

  const status = quotation.status || "DRAFT"

  return (
    <div className="max-w-4xl mx-auto">
      <button type="button" className="btn-link mb-4" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{quotation.title || "Quotation"}</h1>
              <p className="text-gray-500 mt-1">
                {quotation.quotation_number} · v{quotation.version}
              </p>
            </div>
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusClass[status] || "bg-gray-100 text-gray-800"}`}>
              {quotation.status}
            </span>
          </div>
        </div>

        <dl className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Total</dt>
            <dd className="text-lg font-semibold text-gray-900">
              {quotation.currency || "USD"} {quotation.total ? Number(quotation.total).toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Subtotal</dt>
            <dd className="text-gray-900">{quotation.subtotal ? Number(quotation.subtotal).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Estimate timeline</dt>
            <dd className="text-gray-900">{quotation.estimated_timeline || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Valid until</dt>
            <dd className="text-gray-900">
              {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : "No expiry"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Payment terms</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{quotation.payment_terms || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Terms &amp; conditions</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{quotation.terms_and_conditions || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default QuotationDetails