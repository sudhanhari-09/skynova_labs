import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getContract, Contract } from "../../services/api"
import { Spinner } from "../../components/ui"

const statusClass: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  INTERNAL_REVIEW: "bg-yellow-100 text-yellow-800",
  SENT: "bg-primary-100 text-primary-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  EXPIRED: "bg-red-100 text-red-800",
  CANCELLED: "bg-red-100 text-red-800",
}

const ContractDetails: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const id = Number(contractId)
      if (!id) {
        setError("Invalid contract identifier.")
        setLoading(false)
        return
      }
      try {
        const data = await getContract(id)
        if (!active) return
        setContract(data)
      } catch (e: any) {
        if (!active) return
        setError(e.message || "Failed to load contract.")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [contractId])

  if (loading) {
    return (
      <div className="py-16">
        <Spinner className="mx-auto" />
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="bg-white rounded-lg shadow p-10 text-center">
        <div className="alert alert-error">
          <span className="alert-text">{error || "Contract not found."}</span>
        </div>
        <button type="button" className="btn-secondary mt-4" onClick={() => navigate("/admin/contracts")}>
          Back to contracts
        </button>
      </div>
    )
  }

  const status = contract.status || "DRAFT"

  return (
    <div className="max-w-4xl mx-auto">
      <button type="button" className="btn-link mb-4" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{contract.contract_number}</h1>
              <p className="text-gray-500 mt-1">{contract.title || "Contract"}</p>
            </div>
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusClass[status] || "bg-gray-100 text-gray-800"}`}>
              {contract.status}
            </span>
          </div>
        </div>

        <dl className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Quotation</dt>
            <dd className="text-gray-900">
              {contract.quotation_id ? `Reference #${contract.quotation_id}` : "—"}{" "}
              {contract.quotation_id ? `(v${contract.quotation_version || "1"})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900">{contract.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Start date</dt>
            <dd className="text-gray-900">
              {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">End date</dt>
            <dd className="text-gray-900">
              {contract.end_date ? new Date(contract.end_date).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Scope</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{contract.scope || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Deliverables</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{contract.deliverables || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Payment terms</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{contract.payment_terms || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Terms &amp; conditions</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{contract.terms_and_conditions || "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default ContractDetails