import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { useNavigate } from "react-router-dom"
import { fetchProjects, Project } from "../../services/api"
import { StateError } from "../../components/ui"

const ProjectsList: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    search: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate])

  const loadProjects = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchProjects(
        filters.status,
        filters.priority,
        undefined,
        filters.search,
        1,
        50
      )
      setProjects(response.projects || [])
      setTotal(response.total || 0)
    } catch (error: any) {
      setError(error?.message || "Failed to load projects. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target
    setFilters({ ...filters, [name]: value })
  }

  const handleApplyFilters = () => {
    loadProjects()
  }

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800"
      case "COMPLETED":
        return "bg-green-100 text-green-800"
      case "ON_HOLD":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const priorityClass = (priority: string) => {
    switch (priority) {
      case "HIGH":
      case "CRITICAL":
        return "text-red-600 font-semibold"
      case "MEDIUM":
        return "text-yellow-600 font-semibold"
      default:
        return "text-green-600 font-semibold"
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-end mb-4">
          <button
            className="bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium"
            onClick={() => navigate("/admin/projects/new")}
          >
            + New Project
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                onChange={handleFilterChange}
                value={filters.status}
              >
                <option value="">All statuses</option>
                <option value="PLANNING">PLANNING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                name="priority"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                onChange={handleFilterChange}
                value={filters.priority}
              >
                <option value="">All priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                name="search"
                placeholder="Title, number, acronym..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>
            <div className="flex items-end">
              <button
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                onClick={handleApplyFilters}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="py-8 text-center text-gray-500">Loading projects...</div>
        )}

        {!isLoading && total === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-3">📁</div>
            <h3 className="text-lg font-semibold text-gray-900">No Projects Found</h3>
            <p className="text-gray-500 mt-1">No projects match the current filters.</p>
          </div>
        )}

        {!isLoading && total > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target End</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{p.title}</div>
                        <div className="text-xs text-gray-500">
                          {p.project_number}
                          {p.acronym ? ` · ${p.acronym}` : ""}
                          {p.contact_name ? ` · ${p.contact_name}` : ""}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                        <div className={`text-xs mt-1 ${priorityClass(p.priority)}`}>{p.priority}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.manager_name || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-500 mb-1">
                          {p.tasks_done}/{p.tasks_count} tasks · {p.milestones_count} milestones
                        </div>
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                          <div
                            className="h-1.5 bg-blue-600 rounded-full"
                            style={{
                              width: p.tasks_count > 0 ? `${Math.round((p.tasks_done / p.tasks_count) * 100)}%` : "0%",
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {p.target_end_date ? new Date(p.target_end_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          onClick={() => navigate(`/admin/projects/${p.id}`)}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default ProjectsList