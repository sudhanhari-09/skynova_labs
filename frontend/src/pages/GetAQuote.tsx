import React, { useEffect, useMemo, useState } from "react"
import { usePageMeta } from "../hooks/usePageMeta"
import {
  listProjectTypes,
  listProjectSubcategories,
  submitQuoteRequest,
  ProjectTypeSummary,
  ProjectSubcategorySummary,
  QuoteRequestResult,
  QuoteRequestPayload,
} from "../services/api"
import { Button, Spinner, Alert } from "../components/ui"
import { ChevronLeft, ChevronRight } from "../components/icons"
import { validateDateString } from "../utils/date"
import { validateEmail, validatePhone, validateName } from "../utils/validation"

interface QuoteForm {
  projectTypeId: string
  subcategoryId: string
  detailed_requirements: string
  target_audience: string
  existing_system: string
  budget: string
  timeline: string
  expected_launch: string
  name: string
  email: string
  phone: string
  whatsapp: string
  company_name: string
  designation: string
}

const emptyForm: QuoteForm = {
  projectTypeId: "",
  subcategoryId: "",
  detailed_requirements: "",
  target_audience: "",
  existing_system: "",
  budget: "",
  timeline: "",
  expected_launch: "",
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  company_name: "",
  designation: "",
}

const STEPS = [
  { title: "Project Type", subtitle: "What do you want to build?" },
  { title: "Category", subtitle: "Narrow down the category" },
  { title: "Requirements", subtitle: "Describe what you need" },
  { title: "Details", subtitle: "Business & technical context" },
  { title: "Budget & Timeline", subtitle: "Your expectations" },
  { title: "Contact", subtitle: "How to reach you" },
  { title: "Attachments", subtitle: "Optional supporting files" },
  { title: "Review & Submit", subtitle: "Confirm and send" },
]

const GetAQuote: React.FC = () => {
  usePageMeta({
    title: "Get a Quote",
    description:
      "Get a tailored proposal from Skynova Project Labs. A few simple steps to tell us about your project, requirements, budget and timeline.",
    canonical: "/quote",
  })

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<QuoteForm>(emptyForm)
  const [files, setFiles] = useState<File[]>([])

  const [projectTypes, setProjectTypes] = useState<ProjectTypeSummary[]>([])
  const [subcategories, setSubcategories] = useState<ProjectSubcategorySummary[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  // Bumping this token re-runs the project-type load (used by the retry action).
  const [catalogReloadToken, setCatalogReloadToken] = useState(0)
  const [subsLoading, setSubsLoading] = useState(false)

  const [perStepErrors, setPerStepErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<QuoteRequestResult | null>(null)

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    // Clear any previous failure so a retry starts from a clean state.
    setCatalogError(null)
    listProjectTypes()
      .then((data) => {
        if (!active) return
        setProjectTypes(data)
        setCatalogError(null)
      })
      .catch((e: any) => {
        if (!active) return
        // The request failed: keep the catalog empty and surface the API error.
        setProjectTypes([])
        setCatalogError(e?.message || "Could not load project types.")
      })
      .finally(() => active && setCatalogLoading(false))
    return () => {
      active = false
    }
  }, [catalogReloadToken])

  // Retries the actual failed project-type request (no page reload).
  const retryLoadProjectTypes = () => setCatalogReloadToken((token) => token + 1)

  useEffect(() => {
    const typeId = Number(form.projectTypeId)
    if (!typeId) {
      setSubcategories([])
      return
    }
    let active = true
    setSubsLoading(true)
    setForm((f) => ({ ...f, subcategoryId: "" }))
    listProjectSubcategories(typeId)
      .then((data) => active && setSubcategories(data))
      .catch(() => active && setSubcategories([]))
      .finally(() => active && setSubsLoading(false))
    return () => {
      active = false
    }
  }, [form.projectTypeId])

  const selectedType = useMemo(
    () => projectTypes.find((t) => String(t.id) === form.projectTypeId),
    [projectTypes, form.projectTypeId]
  )
  const selectedSub = useMemo(
    () => subcategories.find((s) => String(s.id) === form.subcategoryId),
    [subcategories, form.subcategoryId]
  )

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {}
    if (s === 0 && !form.projectTypeId) errs.projectTypeId = "Choose a project type to continue."
    if (s === 1 && !form.subcategoryId) errs.subcategoryId = "Choose a subcategory to continue."
    if (s === 2) {
      const req = form.detailed_requirements.trim()
      if (!req) errs.detailed_requirements = "Please describe your requirements."
      else if (req.length < 10) errs.detailed_requirements = "Please provide more detail in your requirements (at least 10 characters)."
    }
    if (s === 3) {
      if (form.target_audience.trim() && form.target_audience.trim().length < 2) errs.target_audience = "Please provide a valid target audience."
      if (form.existing_system.trim() && form.existing_system.trim().length < 2) errs.existing_system = "Please provide a valid description."
    }
    if (s === 4) {
      const budgetVal = form.budget.trim()
      if (budgetVal) {
        if (!/^[1-9]\d{0,10}$/.test(budgetVal)) errs.budget = "Please enter a valid budget amount in INR."
        else {
          const num = Number(budgetVal)
          if (!Number.isFinite(num) || num < 1 || num > 99999999999) errs.budget = "Please enter a valid budget amount in INR."
        }
      }
      const timelineVal = form.timeline.trim()
      if (timelineVal) {
        if (!/^[1-9]\d{0,2}$/.test(timelineVal)) errs.timeline = "Please enter a valid timeline in months."
        else {
          const num = Number(timelineVal)
          if (!Number.isFinite(num) || num < 1 || num > 120) errs.timeline = "Please enter a valid timeline in months."
        }
      }
      if (form.expected_launch.trim()) {
        const result = validateDateString(form.expected_launch.trim(), { minYear: 1900, maxYear: 2100, futureOnly: true })
        if (!result.valid) errs.expected_launch = result.error || "Please enter a future date."
      }
    }
    if (s === 5) {
      const nameResult = validateName(form.name)
      if (!nameResult.valid) errs.name = nameResult.error || "Please enter your name."
      else if (/^\d+$/.test(form.name.trim())) errs.name = "Please enter a valid name (not just numbers)."
      const emailResult = validateEmail(form.email)
      if (!emailResult.valid) errs.email = emailResult.error || "Please enter your email."
      const phoneResult = validatePhone(form.phone)
      if (!phoneResult.valid) errs.phone = phoneResult.error || "Please enter your phone number."
      const waResult = validatePhone(form.whatsapp)
      if (!waResult.valid) errs.whatsapp = waResult.error || "Please enter your WhatsApp number."
      if (form.company_name.trim() && form.company_name.trim().length < 2) errs.company_name = "Please enter a valid company name."
      if (form.designation.trim() && form.designation.trim().length < 2) errs.designation = "Please enter a valid designation."
    }
    setPerStepErrors(errs)
    return Object.keys(errs).length === 0
  }

  const goNext = () => {
    if (!validateStep(step)) return
    setSubmitError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setSubmitError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    if (!selectedType || !selectedSub) {
      setSubmitError("Please choose a project type and subcategory.")
      return
    }
    if (form.budget.trim()) {
      if (!/^[1-9]\d{0,10}$/.test(form.budget.trim()) || !Number.isFinite(Number(form.budget.trim())) || Number(form.budget.trim()) < 1 || Number(form.budget.trim()) > 99999999999) {
        setSubmitError("Please enter a valid budget amount in INR.")
        return
      }
    }
    if (form.timeline.trim()) {
      if (!/^[1-9]\d{0,2}$/.test(form.timeline.trim()) || !Number.isFinite(Number(form.timeline.trim())) || Number(form.timeline.trim()) < 1 || Number(form.timeline.trim()) > 120) {
        setSubmitError("Please enter a valid timeline in months.")
        return
      }
    }
    if (form.expected_launch.trim()) {
      const dateResult = validateDateString(form.expected_launch.trim(), { minYear: 1900, maxYear: 2100, futureOnly: true })
      if (!dateResult.valid) {
        setSubmitError(dateResult.error || "Please enter a valid future date for Expected launch.")
        return
      }
    }
    setSubmitting(true)
    try {
      const payload: QuoteRequestPayload = {
        project_type_name: selectedType.name,
        subcategory_name: selectedSub.name,
        project_type_slug: selectedType.slug,
        subcategory_slug: selectedSub.slug,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        source: "website",
      }
      const optionalFields: { key: keyof QuoteForm; apiField: keyof QuoteRequestPayload }[] = [
        { key: "company_name", apiField: "company_name" },
        { key: "designation", apiField: "designation" },
        { key: "budget", apiField: "budget" },
        { key: "timeline", apiField: "timeline" },
        { key: "target_audience", apiField: "target_audience" },
        { key: "existing_system", apiField: "existing_system" },
        { key: "expected_launch", apiField: "expected_launch" },
        { key: "detailed_requirements", apiField: "detailed_requirements" },
      ]
      for (const { key, apiField } of optionalFields) {
        const val = (form[key] as string).trim()
        if (val) payload[apiField] = val as any
      }
      const res = await submitQuoteRequest(payload)
      setResult(res)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "There was a problem submitting your request."
      const fieldErrors = (err as any)?.fieldErrors as Record<string, string> | undefined
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        setPerStepErrors(fieldErrors)
        // Navigate to the first step that has a field error
        const fieldToStep: Record<string, number> = {
          projectTypeId: 0, subcategoryId: 1,
          detailed_requirements: 2,
          target_audience: 3, existing_system: 3,
          budget: 4, timeline: 4, expected_launch: 4,
          name: 5, email: 5, phone: 5, whatsapp: 5, company_name: 5, designation: 5,
        }
        const firstErrorField = Object.keys(fieldErrors)[0]
        const targetStep = fieldToStep[firstErrorField]
        if (targetStep !== undefined) setStep(targetStep)
      }
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto site-container py-16 text-center">
        <div className="bg-white rounded-lg shadow p-10">
          <div className="text-4xl mb-3" aria-hidden="true">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Received</h1>
          <p className="text-gray-600">
            Thank you, {form.name || "friend"}! We have received your quote request.
          </p>
          <p className="text-gray-600 mt-2">
            Reference number:{" "}
            <span className="font-semibold text-blue-600">{result.request_number}</span>
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Our team will review your requirements and prepare a tailored proposal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main id="main" className="max-w-3xl mx-auto site-container py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Get a Quote</h1>
      <p className="text-gray-600 mb-8">
        A few steps to tell us about your project and receive a tailored proposal.
      </p>

      {/* Progress indicator */}
      <div className="mb-8" role="status" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].title}`}>
        <div className="flex items-center justify-between mb-2 text-xs font-medium text-gray-500">
          <span className="text-blue-600">Step {step + 1} of {STEPS.length}</span>
          <span>{STEPS[step].title}</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {catalogError && (
        <Alert className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{catalogError} Please try again later.</span>
            <Button type="button" variant="secondary" size="sm" onClick={retryLoadProjectTypes}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 sm:p-8 space-y-5">
        <div aria-live="polite">
          <h2 className="text-xl font-bold text-gray-900">{STEPS[step].title}</h2>
          <p className="text-sm text-gray-500 mb-5">{STEPS[step].subtitle}</p>
        </div>

        {submitError && (
          <Alert className="mb-4">{submitError}</Alert>
        )}

        {step === 0 && (
          <div className="space-y-4">
            {catalogLoading ? (
              <div className="py-8"><Spinner className="mx-auto" label="Loading project types…" /></div>
            ) : catalogError ? (
              <div className="text-center py-8 text-gray-500">
                Project types couldn’t be loaded. Use Retry to try again.
              </div>
            ) : projectTypes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No project types available yet. Please check back soon.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projectTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, projectTypeId: String(t.id) }))}
                    aria-pressed={form.projectTypeId === String(t.id)}
                    className={`text-left rounded-md border p-4 transition-colors ${
                      form.projectTypeId === String(t.id)
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-200"
                    }`}
                  >
                    <div className="font-medium text-gray-900">{t.name}</div>
                    {t.description && <div className="text-xs text-gray-500 mt-1">{t.description}</div>}
                  </button>
                ))}
              </div>
            )}
            {perStepErrors.projectTypeId && <p className="text-sm text-red-600" role="alert">{perStepErrors.projectTypeId}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{selectedType?.name || ""}</p>
            {subsLoading ? (
              <div className="py-8"><Spinner className="mx-auto" label="Loading subcategories…" /></div>
            ) : subcategories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No subcategories available.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subcategories.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, subcategoryId: String(s.id) }))}
                    aria-pressed={form.subcategoryId === String(s.id)}
                    className={`text-left rounded-md border p-4 transition-colors ${
                      form.subcategoryId === String(s.id)
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-200"
                    }`}
                  >
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-500 mt-1">{s.description}</div>}
                  </button>
                ))}
              </div>
            )}
            {perStepErrors.subcategoryId && <p className="text-sm text-red-600" role="alert">{perStepErrors.subcategoryId}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <label htmlFor="detailed_requirements" className="label"><span className="label-text">Describe your requirements *</span></label>
            <textarea
              id="detailed_requirements"
              name="detailed_requirements"
              rows={5}
              maxLength={5000}
              className="input input-bordered w-full"
              placeholder="What are the core features and functionality you need?"
              value={form.detailed_requirements}
              onChange={handleChange}
            />
            {perStepErrors.detailed_requirements && <p className="text-sm text-red-600" role="alert">{perStepErrors.detailed_requirements}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="target_audience" className="label"><span className="label-text">Target audience</span></label>
              <input id="target_audience" name="target_audience" maxLength={500} className="input input-bordered w-full" placeholder="Who will use this?" value={form.target_audience} onChange={handleChange} />
              {perStepErrors.target_audience && <p className="text-sm text-red-600" role="alert">{perStepErrors.target_audience}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="existing_system" className="label"><span className="label-text">Existing system</span></label>
              <textarea id="existing_system" name="existing_system" rows={3} maxLength={2000} className="input input-bordered w-full" placeholder="Is there anything this replaces or integrates with?" value={form.existing_system} onChange={handleChange} />
              {perStepErrors.existing_system && <p className="text-sm text-red-600" role="alert">{perStepErrors.existing_system}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="budget" className="label"><span className="label-text">Approximate budget (INR)</span></label>
              <input id="budget" name="budget" className="input input-bordered w-full" placeholder="e.g. 50000" value={form.budget} onChange={handleChange} />
              {perStepErrors.budget && <p className="text-sm text-red-600" role="alert">{perStepErrors.budget}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="timeline" className="label"><span className="label-text">Timeline (months)</span></label>
              <input id="timeline" name="timeline" className="input input-bordered w-full" placeholder="e.g. 3" value={form.timeline} onChange={handleChange} />
              {perStepErrors.timeline && <p className="text-sm text-red-600" role="alert">{perStepErrors.timeline}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="expected_launch" className="label"><span className="label-text">Expected launch</span></label>
              <input id="expected_launch" name="expected_launch" type="date" className="input input-bordered w-full" value={form.expected_launch} onChange={handleChange} />
              {perStepErrors.expected_launch && <p className="text-sm text-red-600" role="alert">{perStepErrors.expected_launch}</p>}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="label"><span className="label-text">Full name *</span></label>
              <input id="name" name="name" maxLength={150} className="input input-bordered w-full" placeholder="Your name" value={form.name} onChange={handleChange} />
              {perStepErrors.name && <p className="text-sm text-red-600" role="alert">{perStepErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="label"><span className="label-text">Email *</span></label>
              <input id="email" name="email" type="email" maxLength={254} className="input input-bordered w-full" placeholder="name@example.com" value={form.email} onChange={handleChange} />
              {perStepErrors.email && <p className="text-sm text-red-600" role="alert">{perStepErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="label"><span className="label-text">Phone *</span></label>
              <input id="phone" name="phone" type="tel" maxLength={20} className="input input-bordered w-full" placeholder="+1 555 000 0000" value={form.phone} onChange={handleChange} />
              {perStepErrors.phone && <p className="text-sm text-red-600" role="alert">{perStepErrors.phone}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="whatsapp" className="label"><span className="label-text">WhatsApp *</span></label>
              <input id="whatsapp" name="whatsapp" maxLength={20} className="input input-bordered w-full" placeholder="+1 555 000 0000" value={form.whatsapp} onChange={handleChange} />
              {perStepErrors.whatsapp && <p className="text-sm text-red-600" role="alert">{perStepErrors.whatsapp}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="company_name" className="label"><span className="label-text">Company</span></label>
              <input id="company_name" name="company_name" maxLength={200} className="input input-bordered w-full" placeholder="Company name" value={form.company_name} onChange={handleChange} />
              {perStepErrors.company_name && <p className="text-sm text-red-600" role="alert">{perStepErrors.company_name}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="designation" className="label"><span className="label-text">Designation</span></label>
              <input id="designation" name="designation" maxLength={100} className="input input-bordered w-full" placeholder="e.g. CTO" value={form.designation} onChange={handleChange} />
              {perStepErrors.designation && <p className="text-sm text-red-600" role="alert">{perStepErrors.designation}</p>}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <label htmlFor="files" className="block cursor-pointer">
              <span className="input input-bordered w-full inline-flex items-center justify-center py-3 text-sm text-gray-600 hover:bg-gray-50">
                Choose files to attach
              </span>
            </label>
            <input id="files" type="file" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && (
              <ul className="text-sm text-gray-600 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><span aria-hidden="true">📎</span>{f.name}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500">Files shown for reference only. Attachments are not uploaded with this form. Share files with your account manager after submission.</p>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Review your request</h3>
            <dl className="def-list rounded-md border border-gray-200 divide-y divide-gray-100">
              <ReviewRow label="Project type" value={selectedType?.name || "—"} />
              <ReviewRow label="Category" value={selectedSub?.name || "—"} />
              <ReviewRow label="Requirements" value={form.detailed_requirements || "—"} />
              <ReviewRow label="Target audience" value={form.target_audience || "—"} />
              <ReviewRow label="Existing system" value={form.existing_system || "—"} />
              <ReviewRow label="Budget" value={form.budget || "—"} />
              <ReviewRow label="Timeline" value={form.timeline || "—"} />
              <ReviewRow label="Expected launch" value={form.expected_launch || "—"} />
              <ReviewRow label="Name" value={form.name || "—"} />
              <ReviewRow label="Email" value={form.email || "—"} />
              <ReviewRow label="Phone" value={form.phone || "—"} />
              <ReviewRow label="WhatsApp" value={form.whatsapp || "—"} />
              <ReviewRow label="Company" value={form.company_name || "—"} />
              <ReviewRow label="Designation" value={form.designation || "—"} />
              <ReviewRow label="Attachments" value={files.length ? `${files.length} file(s)` : "None"} />
            </dl>
            <p className="text-xs text-gray-500">
              By submitting you agree to be contacted about your request.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={goBack} disabled={step === 0 || submitting} className="inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} className="inline-flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" loading={submitting} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          )}
        </div>
      </form>
    </main>
  )
}

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
    <dt className="text-gray-500">{label}</dt>
    <dd className="font-medium text-gray-900 text-right">{value}</dd>
  </div>
)

export default GetAQuote
