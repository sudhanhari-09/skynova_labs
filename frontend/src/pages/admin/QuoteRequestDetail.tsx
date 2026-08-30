import React, { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader, StatusBadge, Spinner, StateError, Alert, Input, Label, Select, Button } from "../../components/ui"
import { getQuoteRequest, updateQuoteRequest, QuoteRequest } from "../../services/api"

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUOTED", "QUALIFIED", "WON", "LOST"]

const QuoteRequestDetail: React.FC = () => {
  const { quoteRequestId } = useParams()
  const navigate = useNavigate()
  const id = Number(quoteRequestId)

  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getQuoteRequest(id)
      setRequest(data)
      setStatus(data.status)
    } catch (e: any) {
      setError(e.message || "Could not load quote request.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (Number.isNaN(id)) {
      navigate("/admin/quote-requests", { replace: true })
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const updated = await updateQuoteRequest(id, status)
      setRequest(updated)
      setSaved(true)
    } catch (e: any) {
      setSaveError(e.message || "Could not update quote request.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <PageHeader
          backTo="/admin/quote-requests"
          title={request ? request.request_number : "Quote Request"}
          subtitle="Incoming request from the public quote form"
          actions={request && <StatusBadge status={request.status} />}
        />

        {loading && (
          <div className="py-16">
            <Spinner className="mx-auto" label="Loading quote request…" />
          </div>
        )}

        {!loading && error && <StateError message={error} onRetry={load} />}

        {!loading && !error && request && (
          <div className="space-y-6">
            <Alert variant="info">
              The detail endpoint currently returns only the request reference, status and creation
              date. Full requirement, budget, and contact fields are a documented backend dependency
              and are not yet exposed by the API.
            </Alert>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-900">Request details</div>
              <dl className="def-list divide-y divide-gray-100">
                <div className="flex justify-between px-5 py-3 text-sm">
                  <dt className="text-gray-500">Request number</dt>
                  <dd className="font-medium text-gray-900">{request.request_number}</dd>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm">
                  <dt className="text-gray-500">Status</dt>
                  <dd><StatusBadge status={request.status} /></dd>
                </div>
                <div className="flex justify-between px-5 py-3 text-sm">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="font-medium text-gray-900">{new Date(request.created_at).toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Update status</h3>
              {saveError && <Alert className="mb-3">{saveError}</Alert>}
              {saved && <Alert variant="success" className="mb-3">Status updated successfully.</Alert>}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" value={status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </div>
                <Button onClick={handleSave} loading={saving} disabled={saving || status === request.status}>
                  {saving ? "Saving…" : "Save status"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default QuoteRequestDetail
