import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { Table, TableHeader, TableRow, TableCell, Button, Badge, Spinner, EmptyState, StateError, StatusBadge, TableHead } from "../../components/ui"
import { useParams, useNavigate } from "react-router-dom"
import { listContracts, getContract } from "../../services/api"

const ContractsList: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    status: ""
  })
  const [isLoadingContracts, setIsLoadingContracts] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    loadContracts()
  }, [isAuthenticated, navigate])

  const loadContracts = async () => {
    setIsLoadingContracts(true)
    setError(null)
    try {
      const response = await listContracts(
        filters.status,
        1,
        50
      )
      setContracts(response.contracts || [])
      setTotal(response.total || 0)
    } catch (error: any) {
      setError(error?.message || "Failed to load contracts. Please try again.")
    } finally {
      setIsLoadingContracts(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters({ ...filters, [name]: value })
    loadContracts()
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
                <option value="SENT">SENT</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
            <div />
          </div>
        </div>

        {isLoadingContracts && (
          <div className="py-8">
            <Spinner className="mx-auto" />
          </div>
        )}

        {total === 0 && !isLoadingContracts && (
          <EmptyState
            icon="FolderOutline"
            title="No Contracts Found"
            description="No contracts match the current filters."
          />
        )}

        {total > 0 && (
          <div className="overflow-x-auto rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Contract #</TableCell>
                  <TableCell>Quotation</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Valid From</TableCell>
                  <TableCell>Valid To</TableCell>
                  <TableCell />
                </TableRow>
              </TableHeader>
              {contracts.map((c) => {
                const statusBadge = (
                  <Badge
                    key={c.status}
                    className={
                      c.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : c.status === "EXPIRED"
                        ? "bg-red-100 text-red-800"
                        : c.status === "SENT"
                        ? "bg-primary-100 text-primary-800"
                        : c.status === "ACCEPTED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {c.status}
                  </Badge>
                )
                const validFrom = c.start_date ? new Date(c.start_date).toLocaleDateString() : "—"
                const validTo = c.expired_at ? new Date(c.expired_at).toLocaleDateString() : "—"
                
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>{c.contract_number}</TableCell>
                    <TableCell>{c.quotation?.quotation_number || "—"}</TableCell>
                    <TableCell>{c.contact?.first_name || "—"} {c.contact?.last_name || "—"}</TableCell>
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell>{validFrom}</TableCell>
                    <TableCell>{validTo}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/admin/contracts/${c.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {contracts.length === 0 && !isLoadingContracts && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="text-center py-8 text-gray-500">
                      No contracts found
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

export default ContractsList