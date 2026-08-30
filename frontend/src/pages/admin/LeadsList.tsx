import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { Table, TableHeader, TableRow, TableCell, TableHead, Button, Badge, Spinner, EmptyState, StateError, StatusBadge } from "../../components/ui"
import { useParams, useNavigate } from "react-router-dom"
import { fetchLeads } from "../../services/api"

const LeadsList: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    project_type: "",
    owner: "",
    search: ""
  })
  const [isLoadingLeads, setIsLoadingLeads] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    loadLeads()
  }, [isAuthenticated, navigate])

  const loadLeads = async () => {
    setIsLoadingLeads(true)
    setError(null)
    try {
      const response = await fetchLeads(
        filters.status,
        filters.priority,
        filters.project_type,
        filters.owner,
        filters.search,
        1,
        50
      )
      setLeads(response.leads || [])
      setTotal(response.total || 0)
    } catch (error: any) {
      setError(error?.message || "Failed to load leads. Please try again.")
    } finally {
      setIsLoadingLeads(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters({ ...filters, [name]: value })
    loadLeads()
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-gray-500 mt-1">Manage sales opportunities and project requests</p>
        </div>

        {/* Toolbar / Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                className="input input-bordered w-full"
                onChange={handleFilterChange}
                value={filters.status}
              >
                <option value="">All statuses</option>
                <option value="NEW">NEW</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="REQUIREMENT_COLLECTED">REQUIREMENT_COLLECTED</option>
                <option value="TECHNICAL_ANALYSIS">TECHNICAL_ANALYSIS</option>
                <option value="ESTIMATION">ESTIMATION</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                className="input input-bordered w-full"
                onChange={handleFilterChange}
                value={filters.priority}
              >
                <option value="">All priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                name="search"
                placeholder="Search by lead number, contact, or company..."
                className="input input-bordered w-full"
                onChange={handleFilterChange}
                value={filters.search}
              />
            </div>
          </div>
        </div>

        {/* Leads Table */}
        {isLoadingLeads && (
          <div className="py-8">
            <Spinner className="mx-auto" />
          </div>
        )}

        {!isLoadingLeads && error && (
          <StateError message={error} onRetry={loadLeads} />
        )}

        {total === 0 && !isLoadingLeads && !error && (
          <EmptyState
            icon="FolderOutline"
            title="No Leads Found"
            description="No leads match the current filters. Create a new quote request to generate leads."
          />
        )}

        {total > 0 && (
          <div className="overflow-x-auto rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead #</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Project Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Next Follow-up</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              {leads.map((lead) => {
                const contact = lead.contact
                const projectType = lead.project_type
                const owner = lead.owner
                const statusBadge = (
                  <StatusBadge key={lead.status} status={lead.status} />
                )
                const priorityBadge = (
                  <StatusBadge key={lead.priority} status={lead.priority} />
                )

                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium">{lead.lead_number}</div>
                      <small>{lead.id}</small>
                    </TableCell>
                    <TableCell>
                      {contact && (
                        <div>
                          <div className="font-medium">{contact.first_name} {contact.last_name}</div>
                          <div className="text-xs text-gray-500">{contact.email}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {projectType && projectType.name ? (
                        <div>{projectType.name}</div>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {statusBadge}
                    </TableCell>
                    <TableCell>{priorityBadge}</TableCell>
                    <TableCell>
                      {owner && owner.name ? (
                        <div>{owner.name}</div>
                      ) : (
                        <div className="text-xs text-gray-500">Unassigned</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500">{lead.created_at?.toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      {lead.next_follow_up_at ? (
                        <div>
                          <div className="font-medium">{lead.next_follow_up_at.toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">{lead.next_follow_up_at.toLocaleTimeString()}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">—</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="text-sm"
                        onClick={() => navigate(`/admin/leads/${lead.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {leads.length === 0 && !isLoadingLeads && !error && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="text-center py-8 text-gray-500">
                      No leads found
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

export default LeadsList