import React, { useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { Button, Input, Label, Textarea, FieldError, Alert } from "../components/ui"
import { Sparkles, FlaskConical, Building, Rocket, Globe } from "../components/icons"
import { submitCollaboration } from "../services/api"

const pathways = [
  {
    id: "build",
    title: "Build With Us",
    icon: Rocket,
    description: "Commission Project Labs to design and build your technology solution from idea to release.",
    cta: "Start a project",
    to: "/start-a-project",
  },
  {
    id: "research",
    title: "Research Collaboration",
    icon: FlaskConical,
    description: "Partner on applied research, experimentation and open problems that push technology forward.",
    cta: "Propose a collaboration",
    to: "/collaborate#form",
  },
  {
    id: "partnership",
    title: "Industry Partnership",
    icon: Building,
    description: "Formal partnerships across our focus industries and technology areas, including academic and hardware partnerships.",
    cta: "Partner with us",
    to: "/collaborate#form",
  },
  {
    id: "investor",
    title: "Investor / Mentor",
    icon: Sparkles,
    description: "Back or mentor the ideas and products coming out of our pipeline.",
    cta: "Get in touch",
    to: "/collaborate#form",
  },
  {
    id: "strategic",
    title: "Strategic Collaboration",
    icon: Globe,
    description: "Long-term, multi-project relationships — technology partnerships, strategic roadmaps and co-development.",
    cta: "Talk strategy",
    to: "/collaborate#form",
  },
]

const Collaborate: React.FC = () => {
  usePageMeta({
    title: "Collaborate",
    description:
      "Ways to work with Skynova Project Labs — build with us, research collaboration, partnerships, investment and strategic collaboration.",
    canonical: "/collaborate",
  })

  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    type: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = "Name is required."
    if (!form.email.trim()) errs.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email."
    if (!form.type) errs.type = "Choose a collaboration type."
    if (!form.message.trim()) errs.message = "Tell us a little about the collaboration."
    setErrors(errs)
    setError(null)
    if (Object.keys(errs).length > 0) return

    setSending(true)
    try {
      await submitCollaboration({ ...form, source: "collaborate" })
      setSent(true)
    } catch (err: any) {
      setError(
        `${err.message || "There was a problem sending your message."} The collaboration API is not available yet. In the meantime, use Start a Project or Get a Quote to reach our team.`
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <main id="main" className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Collaborate with Project Labs</h1>
      <p className="text-gray-600 mb-10 max-w-3xl">
        There are many ways to work with us — whether you want to build, research,
        partner, invest or co-develop something strategic.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
        {pathways.map((p) => {
          const Icon = p.icon
          return (
            <a key={p.id} href={p.to} className="card flex flex-col group hover:border-blue-200 transition-colors">
              <div className="w-11 h-11 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600">{p.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed flex-1">{p.description}</p>
              <span className="btn-link mt-4 inline-flex items-center gap-1">{p.cta} <span aria-hidden="true">→</span></span>
            </a>
          )
        })}
      </div>

      <div id="form" className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Tell us about the collaboration</h2>
        <p className="text-gray-600 mb-6 text-center">We'll get back to you to explore the opportunity.</p>

        {sent && (
          <Alert variant="success" className="mb-6">
            Thank you, {form.name || "there"}! Your collaboration enquiry has been received.
          </Alert>
        )}

        {error && <Alert className="mb-6">{error}</Alert>}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="c-name" required>Name</Label>
              <Input id="c-name" name="name" value={form.name} onChange={handleChange} invalid={!!errors.name} />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="c-email" required>Email</Label>
              <Input id="c-email" name="email" type="email" value={form.email} onChange={handleChange} invalid={!!errors.email} />
              <FieldError>{errors.email}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="c-org">Organization</Label>
            <Input id="c-org" name="organization" value={form.organization} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="c-type" required>Collaboration type</Label>
            <select id="c-type" name="type" className="input input-bordered w-full" value={form.type} onChange={handleChange}>
              <option value="">Select…</option>
              {pathways.map((p) => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
            <FieldError>{errors.type}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-message" required>Message</Label>
            <Textarea id="c-message" name="message" rows={4} value={form.message} onChange={handleChange} invalid={!!errors.message} />
            <FieldError>{errors.message}</FieldError>
          </div>
          <Button type="submit" loading={sending} disabled={sending}>
            {sending ? "Sending…" : "Send enquiry"}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default Collaborate
