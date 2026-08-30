import React, { useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { submitStartProject } from "../services/api"
import { Button, Input, Label, Textarea, FieldError, Alert, Spinner } from "../components/ui"

type FormErrors = Record<string, string>

const StartAProject: React.FC = () => {
  usePageMeta({
    title: "Start a Project",
    description:
      "Have an idea worth building? Share it with Skynova Project Labs and we'll help you scope it through discovery and validation.",
    canonical: "/start-a-project",
  })

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    idea: "",
    problem: "",
    expected_outcome: "",
    industry: "",
    preferred_technology: "",
    budget: "",
    timeline: "",
    fileDescription: "",
  })
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = (): FormErrors => {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = "Please enter your name."
    if (!form.email.trim()) e.email = "Please enter your email."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Please enter a valid email address."
    if (!form.phone.trim()) e.phone = "Please enter your phone number."
    else if (!/^[+]?[\d\s\-().]{7,20}$/.test(form.phone.trim())) e.phone = "Please enter a valid phone number."
    if (!form.idea.trim()) e.idea = "Please describe your idea."
    return e
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const errs = validate()
    setErrors(errs)
    setSubmitError(null)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    try {
      const res = await submitStartProject({
        name: form.name,
        company: form.company || null,
        email: form.email,
        phone: form.phone,
        idea: form.idea,
        problem: form.problem || null,
        expected_outcome: form.expected_outcome || null,
        industry: form.industry || null,
        preferred_technology: form.preferred_technology || null,
        budget: form.budget || null,
        timeline: form.timeline || null,
        source: "start-a-project",
      })
      setSubmitted(true)
      return res
    } catch (err: any) {
      setSubmitError(
        `${err.message || "There was a problem submitting your project intake."} This intake channel is not yet accepting submissions. Please use Get a Quote or Collaborate to reach our team.`
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-lg shadow p-10">
          <div className="text-4xl mb-3" aria-hidden="true">🚀</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Idea Received</h1>
          <p className="text-gray-600">
            Thank you, {form.name || "there"}! Your project idea has been received and will be reviewed by our team.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            We'll be in touch at <span className="font-medium text-blue-600">{form.email}</span> shortly.
          </p>
          <div className="mt-6">
            <Link to="/" className="btn-secondary">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main id="main" className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Start a Project</h1>
      <p className="text-gray-600 mb-8">
        You have an idea and need discovery. Tell us about it and we'll help scope it from first principles.
      </p>

      {submitError && (
        <Alert variant="warning" className="mb-6">
          <p className="font-medium">Submission unavailable</p>
          <p className="mt-1">{submitError}</p>
          <p className="mt-2 text-sm">
            In the meantime, you can{" "}
            <Link to="/quote" className="underline font-medium">Get a Quote</Link> or{" "}
            <Link to="/collaborate" className="underline font-medium">Collaborate with us</Link>.
          </p>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-5" noValidate>
        <fieldset className="space-y-4">
          <legend className="font-semibold text-gray-900">Your contact details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" required>Full name</Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} invalid={!!errors.name} aria-describedby={errors.name ? "name-err" : undefined} />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" value={form.company} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="email" required>Email</Label>
              <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} />
              <FieldError>{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone" required>Phone</Label>
              <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-err" : undefined} />
              <FieldError>{errors.phone}</FieldError>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-semibold text-gray-900">About your idea</legend>
          <div>
            <Label htmlFor="idea" required>The idea</Label>
            <Textarea id="idea" name="idea" rows={4} value={form.idea} onChange={handleChange} invalid={!!errors.idea} placeholder="What are you thinking about building?" aria-describedby={errors.idea ? "idea-err" : undefined} />
            <FieldError>{errors.idea}</FieldError>
          </div>
          <div>
            <Label htmlFor="problem">The problem it solves</Label>
            <Textarea id="problem" name="problem" rows={3} value={form.problem} onChange={handleChange} placeholder="What problem does this solve, and for whom?" />
          </div>
          <div>
            <Label htmlFor="expected_outcome">Expected outcome</Label>
            <Textarea id="expected_outcome" name="expected_outcome" rows={3} value={form.expected_outcome} onChange={handleChange} placeholder="What does success look like?" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-semibold text-gray-900">Scope &amp; technology</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" value={form.industry} onChange={handleChange} placeholder="e.g. Healthcare, Agriculture…" />
            </div>
            <div>
              <Label htmlFor="preferred_technology">Preferred technology (if known)</Label>
              <Input id="preferred_technology" name="preferred_technology" value={form.preferred_technology} onChange={handleChange} placeholder="e.g. Web app, IoT…" />
            </div>
            <div>
              <Label htmlFor="budget">Budget (if known)</Label>
              <Input id="budget" name="budget" value={form.budget} onChange={handleChange} placeholder="e.g. $10k–$30k" />
            </div>
            <div>
              <Label htmlFor="timeline">Timeline</Label>
              <Input id="timeline" name="timeline" value={form.timeline} onChange={handleChange} placeholder="e.g. 2–4 months" />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-semibold text-gray-900">Attachments (optional)</legend>
          <label htmlFor="files" className="block cursor-pointer">
            <span className="input input-bordered w-full inline-flex items-center justify-center py-3 text-sm text-gray-600 hover:bg-gray-50">
              Choose files to attach
            </span>
          </label>
          <input
            id="files"
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <ul className="text-sm text-gray-600 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden="true">📎</span> {f.name}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">
            Backend file upload is required to attach documents. Offline selection is for preview only.
          </p>
        </fieldset>

        <div className="pt-2">
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit my project idea"}
          </Button>
        </div>
      </form>
    </main>
  )
}

export default StartAProject
