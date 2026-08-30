import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { useParams, useNavigate } from "react-router-dom"
import {
  getProject,
  updateProject,
  changeProjectStatus,
  assignProjectManager,
  fetchProjectMembers,
  addProjectMember,
  removeProjectMember,
  fetchMilestones,
  createMilestone,
  updateMilestone,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchTaskComments,
  addTaskComment,
  fetchProjectUpdates,
  createProjectUpdate,
  Project,
  ProjectMember,
  Milestone,
  TaskItem,
  TaskComment,
  ProjectUpdateItem,
} from "../../services/api"

type Tab = "overview" | "members" | "milestones" | "tasks" | "updates"

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<Tab>("overview")
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [updates, setUpdates] = useState<ProjectUpdateItem[]>([])
  const [comments, setComments] = useState<Record<number, TaskComment[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New item forms
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newMemberRole, setNewMemberRole] = useState("DEVELOPER")
  const [newMilestoneName, setNewMilestoneName] = useState("")
  const [updateContent, setUpdateContent] = useState("")
  const [commentTexts, setCommentTexts] = useState<Record<number, string>>({})

  const projectIdNum = Number(projectId)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, projectId])

  const loadAll = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const p = await getProject(projectIdNum)
      setProject(p)
      const [m, ms, t, u] = await Promise.all([
        fetchProjectMembers(projectIdNum),
        fetchMilestones(projectIdNum),
        fetchTasks(projectIdNum),
        fetchProjectUpdates(projectIdNum),
      ])
      setMembers(m)
      setMilestones(ms)
      setTasks(t)
      setUpdates(u)
    } catch (e: any) {
      setError(e.message || "Failed to load project")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      const updated = await changeProjectStatus(projectIdNum, status)
      setProject(updated)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleAddMember = async () => {
    const userId = prompt("Enter user ID to add:")
    if (!userId) return
    try {
      await addProjectMember(projectIdNum, { user_id: Number(userId), role: newMemberRole })
      setMembers(await fetchProjectMembers(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm("Remove this member?")) return
    try {
      await removeProjectMember(projectIdNum, memberId)
      setMembers(await fetchProjectMembers(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleAddMilestone = async () => {
    if (!newMilestoneName.trim()) return
    try {
      await createMilestone(projectIdNum, { name: newMilestoneName.trim() })
      setNewMilestoneName("")
      setMilestones(await fetchMilestones(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleMilestoneStatus = async (milestoneId: number, status: string) => {
    try {
      await updateMilestone(projectIdNum, milestoneId, { status })
      setMilestones(await fetchMilestones(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleAddTask = async (milestoneId?: number) => {
    if (!newTitle.trim()) return
    try {
      await createTask(projectIdNum, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        milestone_id: milestoneId,
      })
      setNewTitle("")
      setNewDescription("")
      setTasks(await fetchTasks(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleTaskStatus = async (taskId: number, status: string) => {
    try {
      await updateTask(projectIdNum, taskId, { status })
      setTasks(await fetchTasks(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm("Delete this task?")) return
    try {
      await deleteTask(projectIdNum, taskId)
      setTasks(await fetchTasks(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const loadComments = async (taskId: number) => {
    try {
      const c = await fetchTaskComments(projectIdNum, taskId)
      setComments((prev) => ({ ...prev, [taskId]: c }))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleAddComment = async (taskId: number) => {
    const text = commentTexts[taskId] || ""
    if (!text.trim()) return
    try {
      await addTaskComment(projectIdNum, taskId, text.trim(), false)
      setCommentTexts((prev) => ({ ...prev, [taskId]: "" }))
      loadComments(taskId)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleAddUpdate = async () => {
    if (!updateContent.trim()) return
    try {
      await createProjectUpdate(projectIdNum, {
        title: updateContent.trim().split("\n")[0].slice(0, 80),
        content: updateContent.trim(),
        update_type: "GENERAL",
        is_internal: false,
        is_user_visible: true,
      })
      setUpdateContent("")
      setUpdates(await fetchProjectUpdates(projectIdNum))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const handleSaveDescription = async () => {
    try {
      const updated = await updateProject(projectIdNum, {
        description: project?.description,
        notes: project?.notes,
      })
      setProject(updated)
      alert("Saved")
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (isLoading) {
    return <main className="min-h-screen bg-gray-50 p-6 text-center text-gray-500">Loading project...</main>
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <p className="text-red-600">{error || "Project not found"}</p>
          <button className="mt-4 text-blue-600 text-sm" onClick={() => navigate("/admin/projects")}>
            ← Back to projects
          </button>
        </div>
      </main>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "members", label: `Team (${members.length})` },
    { id: "milestones", label: `Milestones (${milestones.length})` },
    { id: "tasks", label: `Tasks (${tasks.length})` },
    { id: "updates", label: "Updates" },
  ]

  const statusBadgeClass = (status: string) => {
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

  const secureLink = `${window.location.origin}/project/${project.secure_reference}`

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button className="text-blue-600 text-sm mb-3" onClick={() => navigate("/admin/projects")}>
          ← Back to projects
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{project.title}</h2>
                <span className="text-xs text-gray-400">{project.project_number}</span>
              </div>
              {project.acronym && <div className="text-sm text-gray-500 mt-1">Acronym: {project.acronym}</div>}
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={project.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${statusBadgeClass(project.status)}`}
                >
                  <option value="PLANNING">PLANNING</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
                <span className="text-xs text-gray-500">Priority: {project.priority}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              {project.manager_name && <div>Manager: <span className="font-medium">{project.manager_name}</span></div>}
              {project.contract_number && <div>Contract: <span className="font-medium">{project.contract_number}</span></div>}
              {project.contact_name && <div>Customer: <span className="font-medium">{project.contact_name}</span></div>}
              {project.target_end_date && (
                <div>Target completion: <span className="font-medium">{new Date(project.target_end_date).toLocaleDateString()}</span></div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{project.tasks_count}</div>
              <div className="text-xs text-gray-500">Tasks</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {project.tasks_count > 0 ? `${Math.round((project.tasks_done / project.tasks_count) * 100)}%` : "0%"}
              </div>
              <div className="text-xs text-gray-500">Task Completion</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{members.length}</div>
              <div className="text-xs text-gray-500">Team Members</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{milestones.length}</div>
              <div className="text-xs text-gray-500">Milestones</div>
            </div>
          </div>

          {project.description && <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>}

          <div className="mt-4 bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Customer secure link:</div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-blue-600 bg-white px-2 py-1 rounded border border-gray-200 break-all flex-1">
                {secureLink}
              </code>
              <button
                className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded"
                onClick={() => navigator.clipboard.writeText(secureLink)}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="flex space-x-1 mb-4 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Description</h3>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={5}
              value={project.description || ""}
              onChange={(e) => setProject({ ...project, description: e.target.value })}
            />
            <h3 className="text-lg font-semibold mb-2 mt-4">Internal Notes</h3>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={3}
              value={project.notes || ""}
              onChange={(e) => setProject({ ...project, notes: e.target.value })}
            />
            <button
              className="mt-3 bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
              onClick={handleSaveDescription}
            >
              Save
            </button>

            <h3 className="text-lg font-semibold mb-2 mt-6">Budget</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Full Budget</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={project.full_budget ?? ""}
                  onChange={(e) => setProject({ ...project, full_budget: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer Budget</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={project.customer_budget ?? ""}
                  onChange={(e) => setProject({ ...project, customer_budget: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={project.currency}
                  onChange={(e) => setProject({ ...project, currency: e.target.value })}
                />
              </div>
            </div>
            <button
              className="mt-3 bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
              onClick={handleSaveDescription}
            >
              Save Budget
            </button>
          </div>
        )}

        {/* Team */}
        {tab === "members" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              >
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="DEVELOPER">Developer</option>
                <option value="DESIGNER">Designer</option>
                <option value="QA">QA</option>
                <option value="DEVOPS">DevOps</option>
                <option value="ANALYST">Analyst</option>
              </select>
              <button
                className="bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
                onClick={handleAddMember}
              >
                + Add Member
              </button>
            </div>

            {members.length === 0 && <p className="text-gray-500 text-sm">No team members yet. Add the first member above.</p>}

            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {m.user_name || `User #${m.user_id}`}
                      {m.is_lead && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">LEAD</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {m.role} · {m.status === "ACTIVE" ? "Active" : m.status}
                    </div>
                  </div>
                  <button
                    className="text-red-600 hover:text-red-800 text-sm"
                    onClick={() => handleRemoveMember(m.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {tab === "milestones" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="New milestone name..."
                value={newMilestoneName}
                onChange={(e) => setNewMilestoneName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
              />
              <button
                className="bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
                onClick={handleAddMilestone}
              >
                + Add
              </button>
            </div>

            {milestones.length === 0 && <p className="text-gray-500 text-sm">No milestones yet.</p>}

            <div className="space-y-3">
              {milestones.map((m) => (
                <div key={m.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{m.name}</div>
                      <div className="text-xs text-gray-500">
                        {m.tasks_count} tasks · {m.due_date ? `Due ${new Date(m.due_date).toLocaleDateString()}` : "No due date"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="text-xs px-2 py-1 rounded border border-gray-300"
                        value={m.status}
                        onChange={(e) => handleMilestoneStatus(m.id, e.target.value)}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="DELAYED">DELAYED</option>
                      </select>
                    </div>
                  </div>
                  {m.description && <p className="text-xs text-gray-600 mt-2">{m.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {tab === "tasks" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="New task title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <input
                className="w-1/3 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Description..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
              <button
                className="bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
                onClick={() => handleAddTask()}
              >
                + Add
              </button>
            </div>

            {tasks.length === 0 && <p className="text-gray-500 text-sm">No tasks yet.</p>}

            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClass(t.status)}`}>
                          {t.status}
                        </span>
                        <span className={`text-sm font-medium text-gray-900 ${t.status === "DONE" ? "line-through text-gray-400" : ""}`}>
                          {t.title}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-gray-600 mt-1">{t.description}</p>}
                      <div className="text-xs text-gray-400 mt-1">
                        {t.assignee_name ? `Assigned to: ${t.assignee_name}` : "Unassigned"}
                        {t.milestone_id ? ` · Milestone #${t.milestone_id}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="text-xs px-2 py-1 rounded border border-gray-300"
                        value={t.status}
                        onChange={(e) => handleTaskStatus(t.id, e.target.value)}
                      >
                        <option value="TODO">TODO</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="IN_REVIEW">IN_REVIEW</option>
                        <option value="DONE">DONE</option>
                      </select>
                      <button
                        className="text-red-500 hover:text-red-700 text-xs"
                        onClick={() => handleDeleteTask(t.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <button
                      className="text-xs text-blue-600"
                      onClick={() => loadComments(t.id)}
                    >
                      {comments[t.id]?.length ? `${comments[t.id]!.length} comments` : "Show comments"}
                    </button>
                    {comments[t.id] && (
                      <div className="mt-2 space-y-2">
                        {comments[t.id]!.map((c) => (
                          <div key={c.id} className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-500">{c.author_name || "User"} · {new Date(c.created_at).toLocaleString()}</div>
                            <div className="text-sm text-gray-700">{c.content}</div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                            placeholder="Add comment..."
                            value={commentTexts[t.id] || ""}
                            onChange={(e) => setCommentTexts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(t.id)}
                          />
                          <button
                            className="bg-gray-800 text-white px-3 py-1.5 rounded text-xs"
                            onClick={() => handleAddComment(t.id)}
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Updates */}
        {tab === "updates" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Post Update</h3>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={4}
              placeholder="Progress update visible to the customer..."
              value={updateContent}
              onChange={(e) => setUpdateContent(e.target.value)}
            />
            <button
              className="mt-2 bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm"
              onClick={handleAddUpdate}
            >
              Post Update
            </button>

            {updates.length === 0 && <p className="text-gray-500 text-sm mt-4">No updates posted yet.</p>}

            <div className="mt-4 space-y-3">
              {updates.map((u) => (
                <div key={u.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900">{u.title}</div>
                    {u.is_user_visible ? (
                      <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Visible to customer</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Internal</span>
                    )}
                  </div>
                  {u.content && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{u.content}</p>}
                  <div className="text-xs text-gray-400 mt-2">
                    {u.author_name || "User"} · {new Date(u.created_at).toLocaleString()} · {u.update_type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default ProjectDetails