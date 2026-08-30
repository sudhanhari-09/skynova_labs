import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { ArrowRight } from "../components/icons"
import { fetchServices, fetchTechnologies, fetchIndustries, Service, Technology, Industry } from "../services/api"

const fallbackServices = [
  { name: "AI / Machine Learning", description: "Applied machine learning, LLM integrations, computer vision and predictive systems designed around your data and domain." },
  { name: "Web Applications", description: "Fast, accessible and secure web applications — from internal tools to customer-facing platforms." },
  { name: "Mobile Applications", description: "Cross-platform and native mobile apps that extend your product to phones and tablets." },
  { name: "IoT & Embedded Systems", description: "Connected hardware and firmware — sensors, gateways and dashboards for smart environments." },
  { name: "Robotics & Automation", description: "Automation of workflows, processes and physical systems that remove repetitive human effort." },
  { name: "Data & Analytics", description: "Clean pipelines, dashboards and reporting that turn operational data into decisions." },
]

const fallbackTechnologies = [
  { name: "TypeScript / React", category: "Frontend" },
  { name: "Python / FastAPI", category: "Backend" },
  { name: "PostgreSQL", category: "Database" },
  { name: "Node.js", category: "Backend" },
  { name: "Embedded C / Arduino", category: "Hardware" },
  { name: "Machine Learning", category: "AI / ML" },
  { name: "Computer Vision", category: "AI / ML" },
  { name: "Docker / Cloud", category: "Cloud" },
]

const fallbackIndustries = [
  "Healthcare", "Education", "Agriculture", "Finance", "Manufacturing", "Smart Cities",
  "Environment", "Retail", "Security", "Transportation", "Custom / Other",
]

const Solutions: React.FC = () => {
  usePageMeta({
    title: "Solutions",
    description:
      "Technology solutions from Skynova Project Labs — AI/ML, web and mobile applications, IoT, robotics, automation and data analytics built through disciplined research and engineering.",
    canonical: "/solutions",
  })

  const [services, setServices] = useState<Service[] | null>(null)
  const [technologies, setTechnologies] = useState<Technology[] | null>(null)
  const [industries, setIndustries] = useState<Industry[] | null>(null)

  const load = useCallback(() => {
    fetchServices().then(setServices).catch(() => setServices([]))
    fetchTechnologies().then(setTechnologies).catch(() => setTechnologies([]))
    fetchIndustries().then(setIndustries).catch(() => setIndustries([]))
  }, [])
  useEffect(() => { load() }, [load])

  const serviceList = services && services.length > 0
    ? services
    : fallbackServices.map((s, i) => ({ id: i, name: s.name, slug: "", description: s.description, is_public: true, is_active: true })) as Service[]
  const techList = technologies && technologies.length > 0
    ? technologies
    : fallbackTechnologies.map((t, i) => ({ id: i, name: t.name, slug: "", category: t.category, is_public: true, is_active: true })) as Technology[]
  const industryList = industries && industries.length > 0
    ? industries
    : fallbackIndustries.map((n, i) => ({ id: i, name: n, slug: "" })) as Industry[]

  return (
    <main id="main">
      <section className="hero-section">
        <div className="hero-inner">
          <span className="hero-eyebrow">Solutions</span>
          <h1 className="hero-title">Technology solutions, built the right way.</h1>
          <p className="hero-subtitle">
            From applied AI to embedded systems, we design and build technology that is
            researched, prototyped and validated before it ships.
          </p>
          <div className="hero-actions">
            <Link to="/quote" className="btn-hero btn-hero--primary">
              Get a Quote
            </Link>
            <Link to="/start-a-project" className="btn-hero btn-hero--ghost">
              Start a Project
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-3xl font-bold text-gray-900 mb-2">
          What we build
        </h2>
        <p className="text-gray-600 mb-8 max-w-3xl">
          A focused set of capabilities, each backed by hands-on research and experimentation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceList.map((service) => (
            <Link key={service.id ?? service.name} to="/quote" className="card flex flex-col group hover:border-blue-200 transition-colors">
              <div className="w-11 h-11 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <span className="text-lg font-bold">{service.icon || (service.name || "?").charAt(0)}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600">
                {service.name}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed flex-1">{service.description}</p>
              {service.starting_price !== null && (
                <span className="text-xs text-gray-500 mt-2">
                  From {service.starting_price === 0 ? "contact us" : `$${Number(service.starting_price).toLocaleString()}`} · {service.pricing_model || "project-based"}
                </span>
              )}
              <span className="btn-link mt-4 inline-flex items-center gap-1">
                Explore <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Technologies */}
      <section className="bg-slate-900 text-white py-16" aria-labelledby="tech-heading">
        <div className="max-w-7xl mx-auto px-4">
          <h2 id="tech-heading" className="text-3xl font-bold mb-2">
            Technologies we work with
          </h2>
          <p className="text-gray-300 mb-8 max-w-3xl">
            Our stack evolves with the problem — these are the tools we reach for most.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {techList.map((tech) => (
              <div key={tech.id ?? tech.name} className="bg-white/5 border border-gray-700 rounded-lg p-4">
                <div className="font-medium text-white">{tech.name}</div>
                {tech.category && <div className="text-xs text-blue-600 mt-1 uppercase tracking-wide">{tech.category}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="industries-heading">
        <h2 id="industries-heading" className="text-3xl font-bold text-gray-900 mb-2">
          Industries we serve
        </h2>
        <p className="text-gray-600 mb-8 max-w-3xl">
          Solutions across a wide range of sectors — and custom work beyond them.
        </p>
        <div className="flex flex-wrap gap-3">
          {industryList.map((industry) => (
            <span key={industry.id ?? industry.name} className="px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-700">
              {industry.name}
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Not sure which solution fits?</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            We'll help you scope the right approach for your problem.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/quote" className="btn-primary">
              Get a Quote
            </Link>
            <Link to="/collaborate" className="btn-secondary">
              Collaborate with us
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Solutions