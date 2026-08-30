import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { fetchPublicProject } from "../services/api"

interface PublicMilestone {
  name: string
  description?: string
  due_date?: string
  status: string
  completed_at?: string
}

interface PublicTask {
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  completed_at?: string
  assignee_name?: string
}

interface PublicUpdate {
  title: string
  content?: string
  update_type: string
  created_at: string
}

interface PublicProject {
  project_number: string
  title: string
  acronym?: string
  description?: string
  status: string
  start_date?: string
  target_end_date?: string
  actual_end_date?: string
  milestones: PublicMilestone[]
  tasks: PublicTask[]
  recent_updates: PublicUpdate[]
}

const CustomerProjectView: React.FC = () => {
  const { secureReference } = useParams<{ secureReference: string }>()
  const [project, setProject] = useState<PublicProject | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchPublicProject(secureReference as string)
        setProject(data)
      } catch (e: any) {
        setError(e.message || "Project not found")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [secureReference])

  if (isLoading) {
    return <main className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading project...</main>
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-gray-900">Project Not Found</h2>
          <p className="text-gray-500 mt-1">{error || "This secure link is invalid or the project does not exist."}</p>
        </div>
      </main>
    )
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case "PLANNING":
        return "Planning"
      case "IN_PROGRESS":
        return "In Progress"
      case "ON_HOLD":
        return "On Hold"
      case "COMPLETED":
        return "Completed"
      case "CANCELLED":
        return "Cancelled"
      default:
        return status
    }
  }

  const statusClass = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800"
      case "COMPLETED":
      case "DONE":
        return "bg-green-100 text-green-800"
      case "ON_HOLD":
        return "bg-yellow-100 text-yellow-800"
      case "CANCELLED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="hero-section px-6 py-8">
            <div className="text-sm text-gray-300">{project.project_number}</div>
            <h1 className="text-3xl font-bold mt-1">{project.title}</h1>
            {project.acronym && <div className="text-gray-300 mt-1">{project.acronym}</div>}
            <div className="mt-4 inline-flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass(project.status)}`}>
                {statusLabel(project.status)}
              </span>
              {project.target_end_date && (
                <span className="text-sm text-gray-300">
                  Target completion: {new Date(project.target_end_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {project.description && (
              <p className="text-gray-700 whitespace-pre-wrap mb-6">{project.description}</p>
            )}

            {project.recent_updates && project.recent_updates.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Updates</h2>
                <div className="space-y-3">
                  {project.recent_updates.map((u, i) => (
                    <div key={i} className="border-l-4 border-blue-600 bg-blue-50 rounded-r-lg p-3">
                      <div className="text-sm font-medium text-gray-900">{u.title}</div>
                      {u.content && <p className="text-sm text-gray-700 mt-1">{u.content}</p>}
                      <div className="text-xs text-gray-500 mt-1">{new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {project.milestones && project.milestones.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Milestones</h2>
                <div className="space-y-3">
                  {project.milestones.map((m, i) => (
                    <div key={i} className="flex items-start justify-between border border-gray-200 rounded-lg p-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{m.name}</div>
                        {m.description && <div className="text-xs text-gray-600 mt-1">{m.description}</div>}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusClass(m.status)}`}>{m.status}</span>
                        {m.due_date && (
                          <div className="text-xs text-gray-500 mt-1">{new Date(m.due_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {project.tasks && project.tasks.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Tasks</h2>
                <div className="space-y-2">
                  {project.tasks.map((t, i) => (
                    <div key={i} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                      <div>
                        <div className={`text-sm font-medium ${t.status === "DONE" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {t.title}
                        </div>
                        {t.description && <div className="text-xs text-gray-600 mt-0.5">{t.description}</div>}
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${statusClass(t.status)}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default CustomerProjectView