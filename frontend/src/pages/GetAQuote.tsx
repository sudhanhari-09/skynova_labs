import React, { useEffect, useMemo, useState } from "react"
import { usePageMeta } from "../hooks/usePageMeta"
import {
  listProjectTypes,
  listProjectSubcategories,
  submitQuoteRequest,
  ProjectTypeSummary,
  ProjectSubcategorySummary,
  QuoteRequestResult,
} from "../services/api"
import { Button, Spinner, Alert } from "../components/ui"
import { ChevronLeft, ChevronRight } from "../components/icons"

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
  const [subsLoading, setSubsLoading] = useState(false)

  const [perStepErrors, setPerStepErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<QuoteRequestResult | null>(null)

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    listProjectTypes()
      .then((data) => {
        if (!active) return
        setProjectTypes(data)
        setCatalogError(null)
      })
      .catch((e: any) => active && setCatalogError(e.message || "Could not load project types."))
      .finally(() => active && setCatalogLoading(false))
    return () => {
      active = false
    }
  }, [])

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
    if (s === 3) {
      if (!form.detailed_requirements.trim()) errs.detailed_requirements = "Give us a short description of your requirements."
    }
    if (s === 5) {
      if (!form.name.trim()) errs.name = "Please enter your name."
      if (!form.email.trim()) errs.email = "Please enter your email."
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Please enter a valid email address."
      if (!form.phone.trim()) errs.phone = "Please enter your phone number."
      else if (!/^[+]?[\d\s\-().]{7,20}$/.test(form.phone.trim())) errs.phone = "Please enter a valid phone number."
      if (!form.whatsapp.trim()) errs.whatsapp = "Please enter your WhatsApp number."
      else if (!/^[+]?[\d\s\-().]{7,20}$/.test(form.whatsapp.trim())) errs.whatsapp = "Please enter a valid WhatsApp number."
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
    setSubmitError(null)
    if (!selectedType || !selectedSub) {
      setSubmitError("Please choose a project type and subcategory.")
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, string> = {
        project_type_name: selectedType.name,
        subcategory_name: selectedSub.name,
        project_type_slug: selectedType.slug,
        subcategory_slug: selectedSub.slug,
        name: form.name,
        email: form.email,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        source: "website",
      }
      const optional: (keyof QuoteForm)[] = [
        "company_name", "designation", "budget", "timeline",
        "target_audience", "existing_system", "expected_launch", "detailed_requirements",
      ]
      for (const key of optional) {
        const val = (form[key] as string).trim()
        if (val) payload[key] = val
      }
      const res = await submitQuoteRequest(payload as any)
      setResult(res)
    } catch (err: any) {
      setSubmitError(err.message || "There was a problem submitting your request.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
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
    <main id="main" className="max-w-3xl mx-auto px-4 py-12">
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
          {catalogError} Please try again later.
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
              <input id="target_audience" name="target_audience" className="input input-bordered w-full" placeholder="Who will use this?" value={form.target_audience} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="existing_system" className="label"><span className="label-text">Existing system</span></label>
              <textarea id="existing_system" name="existing_system" rows={3} className="input input-bordered w-full" placeholder="Is there anything this replaces or integrates with?" value={form.existing_system} onChange={handleChange} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="budget" className="label"><span className="label-text">Approximate budget</span></label>
              <input id="budget" name="budget" className="input input-bordered w-full" placeholder="e.g. $20k–$50k" value={form.budget} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="timeline" className="label"><span className="label-text">Timeline</span></label>
              <input id="timeline" name="timeline" className="input input-bordered w-full" placeholder="e.g. 3–6 months" value={form.timeline} onChange={handleChange} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="expected_launch" className="label"><span className="label-text">Expected launch</span></label>
              <input id="expected_launch" name="expected_launch" type="date" className="input input-bordered w-full" value={form.expected_launch} onChange={handleChange} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="label"><span className="label-text">Full name *</span></label>
              <input id="name" name="name" className="input input-bordered w-full" placeholder="Your name" value={form.name} onChange={handleChange} />
              {perStepErrors.name && <p className="text-sm text-red-600" role="alert">{perStepErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="label"><span className="label-text">Email *</span></label>
              <input id="email" name="email" type="email" className="input input-bordered w-full" placeholder="name@example.com" value={form.email} onChange={handleChange} />
              {perStepErrors.email && <p className="text-sm text-red-600" role="alert">{perStepErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="label"><span className="label-text">Phone *</span></label>
              <input id="phone" name="phone" type="tel" className="input input-bordered w-full" placeholder="+1 555 000 0000" value={form.phone} onChange={handleChange} />
              {perStepErrors.phone && <p className="text-sm text-red-600" role="alert">{perStepErrors.phone}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="whatsapp" className="label"><span className="label-text">WhatsApp *</span></label>
              <input id="whatsapp" name="whatsapp" className="input input-bordered w-full" placeholder="+1 555 000 0000" value={form.whatsapp} onChange={handleChange} />
              {perStepErrors.whatsapp && <p className="text-sm text-red-600" role="alert">{perStepErrors.whatsapp}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="company_name" className="label"><span className="label-text">Company</span></label>
              <input id="company_name" name="company_name" className="input input-bordered w-full" placeholder="Company name" value={form.company_name} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="designation" className="label"><span className="label-text">Designation</span></label>
              <input id="designation" name="designation" className="input input-bordered w-full" placeholder="e.g. CTO" value={form.designation} onChange={handleChange} />
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
            <p className="text-xs text-gray-500">File uploads are shown here for review. Backend upload support is a dependency.</p>
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
