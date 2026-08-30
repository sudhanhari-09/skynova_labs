import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createProject } from "../../services/api"

interface NewProjectForm {
  title: string
  acronym: string
  description: string
  start_date: string
}

const emptyForm: NewProjectForm = { title: "", acronym: "", description: "", start_date: "" }

const NewProject: React.FC = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState<NewProjectForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) {
      setError("Project title is required.")
      return
    }
    setSubmitting(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        acronym: form.acronym.trim() || undefined,
        description: form.description.trim() || undefined,
        status: "PLANNING",
        priority: "MEDIUM",
        currency: "USD",
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
      }
      const created = await createProject(payload)
      navigate(`/admin/projects/${created.id}`, { replace: true })
    } catch (err: any) {
      setError(err.message || "Failed to create project.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="text-gray-500 mt-1">
          Create a new project record. You can assign a manager, team and milestones after
          creation.
        </p>
      </header>

      {error && (
        <div className="alert alert-error mb-4">
          <span className="alert-text">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="title" className="label">
            <span className="label-text">Project title *</span>
          </label>
          <input
            id="title"
            name="title"
            className="input input-bordered w-full"
            placeholder="e.g. Customer Portal"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="acronym" className="label">
              <span className="label-text">Acronym</span>
            </label>
            <input
              id="acronym"
              name="acronym"
              className="input input-bordered w-full"
              placeholder="e.g. CP"
              value={form.acronym}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="start_date" className="label">
              <span className="label-text">Start date</span>
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              className="input input-bordered w-full"
              value={form.start_date}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="label">
            <span className="label-text">Description</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            className="input input-bordered w-full"
            placeholder="Describe the project…"
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create Project"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/admin/projects")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewProject