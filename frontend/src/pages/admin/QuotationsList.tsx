import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { Table, TableHeader, TableRow, TableCell, Button, Badge, Spinner, EmptyState, StateError, StatusBadge, TableHead } from "../../components/ui"
import { useParams, useNavigate } from "react-router-dom"
import { listQuotations, getQuotation } from "../../services/api"

const QuotationsList: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    status: "",
    lead_id: ""
  })
  const [isLoadingQuotations, setIsLoadingQuotations] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    loadQuotations()
  }, [isAuthenticated, navigate])

  const loadQuotations = async () => {
    setIsLoadingQuotations(true)
    setError(null)
    try {
      const response = await listQuotations(
        filters.status,
        parseInt(filters.lead_id) || undefined,
        1,
        50
      )
      setQuotations(response.quotations || [])
      setTotal(response.total || 0)
    } catch (error: any) {
      setError(error?.message || "Failed to load quotations. Please try again.")
    } finally {
      setIsLoadingQuotations(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters({ ...filters, [name]: value })
    loadQuotations()
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <select
                name="status"
                className="input input-bordered w-full"
                onChange={handleFilterChange}
                value={filters.status}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="INTERNAL_REVIEW">INTERNAL_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="SENT">SENT</option>
                <option value="VIEWED">VIEWED</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <select
                name="lead_id"
                className="input input-bordered w-full"
                onChange={handleFilterChange}
                value={filters.lead_id || ""}
              >
                <option value="">All leads</option>
              </select>
            </div>
            <div />
          </div>
        </div>

        {isLoadingQuotations && (
          <div className="py-8">
            <Spinner className="mx-auto" />
          </div>
        )}

        {total === 0 && !isLoadingQuotations && (
          <EmptyState
            icon="FolderOutline"
            title="No Quotations Found"
            description="No quotations match the current filters."
          />
        )}

        {total > 0 && (
          <div className="overflow-x-auto rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Quotation #</TableCell>
                    <TableCell>Lead</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Validity</TableCell>
                    <TableCell />
                </TableRow>
              </TableHeader>
              {quotations.map((q) => {
                const statusBadge = <StatusBadge status={q.status} />
                const validityText = q.valid_until 
                  ? `Valid until ${new Date(q.valid_until).toLocaleDateString()}`
                  : "No expiry"
                
                return (
                  <TableRow key={q.id}>
                    <TableCell>{q.id}{q.quotation_number}</TableCell>
                    <TableCell>{q.lead?.contact?.first_name || "â€”"} {q.lead?.contact?.last_name || "â€”"}</TableCell>
                    <TableCell>{q.contact?.company_name || "â€”"}</TableCell>
                    <TableCell>{q.version}</TableCell>
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell>{q.total ? `$${q.total}` : "$â€”"}</TableCell>
                    <TableCell>{validityText}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/admin/quotations/${q.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {quotations.length === 0 && !isLoadingQuotations && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="text-center py-8 text-gray-500">
                      No quotations found
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}

export default QuotationsList