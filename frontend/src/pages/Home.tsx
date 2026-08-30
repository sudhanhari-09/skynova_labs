import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  fetchAchievements,
  fetchExperiments,
  fetchIndustries,
  fetchJournalArticles,
  fetchPartners,
  fetchPublicSite,
  fetchResearch,
  fetchServices,
  fetchTechnologies,
  fetchTestimonials,
  Industry,
  JournalArticle,
  Service,
  Technology,
} from "../services/api"
import { Skeleton } from "../components/ui"

const focusAreas = [
  {
    id: "r",
    title: "Research",
    description:
      "Applied research across software engineering, AI and emerging technologies — validating ideas before they become products.",
    to: "/research",
    cta: "Explore research",
  },
  {
    id: "e",
    title: "Experiments",
    description:
      "Hands-on prototypes and proof-of-concepts that de-risk new technology before production investment.",
    to: "/experiments",
    cta: "See experiments",
  },
  {
    id: "p",
    title: "Product Engineering",
    description:
      "Web, mobile, AI/ML and automation solutions taken from discovery through estimation to disciplined delivery.",
    to: "/projects",
    cta: "View projects",
  },
]

const Home: React.FC = () => {
  const [hero, setHero] = useState({ eyebrow: "Technology Research & Development", title: "We turn ambitious ideas into production-ready products.", subtitle: "SkyNova Project Labs is the innovation engine of SkyNova — combining research, experimentation and disciplined engineering to build software that solves real problems." })
  const [services, setServices] = useState<Service[]>([])
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [research, setResearch] = useState<any[]>([])
  const [experiments, setExperiments] = useState<any[]>([])
  const [blog, setBlog] = useState<JournalArticle[]>([])
  const [testimonials, setTestimonials] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [site, svc, tech, ind, res, exp, b, ts, p, ac] = await Promise.all([
        fetchPublicSite().catch(() => null),
        fetchServices().catch(() => []),
        fetchTechnologies().catch(() => []),
        fetchIndustries().catch(() => []),
        fetchResearch().catch(() => []),
        fetchExperiments().catch(() => []),
        fetchJournalArticles().catch(() => []),
        fetchTestimonials().catch(() => []),
        fetchPartners().catch(() => []),
        fetchAchievements().catch(() => []),
      ])
      if (!active) return
      if (site?.settings) {
        const s = site.settings
        setHero((prev) => ({
          eyebrow: String(s.hero_eyebrow || prev.eyebrow),
          title: String(s.hero_title || prev.title),
          subtitle: String(s.hero_subtitle || prev.subtitle),
        }))
      }
      setServices(svc)
      setTechnologies(tech)
      setIndustries(ind)
      setResearch(res)
      setExperiments(exp)
      setBlog(b)
      setTestimonials(ts)
      setPartners(p)
      setAchievements(ac)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const serviceCards: any[] = services.length > 0 ? services : focusAreas

  return (
    <main id="main">
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-inner">
          <span className="hero-eyebrow">{hero.eyebrow}</span>
          <h1 className="hero-title">{hero.title}</h1>
          <p className="hero-subtitle">{hero.subtitle}</p>
          <div className="hero-actions">
            <Link to="/quote" className="btn-hero btn-hero--primary">
              Get a Quote
            </Link>
            <Link to="/start-a-project" className="btn-hero btn-hero--ghost">
              Start a Project
            </Link>
            <Link to="/research" className="btn-hero btn-hero--ghost">
              Explore our Research
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </section>
      ) : (
        <>
          {/* Services */}
          <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="services-heading">
            <h2 id="services-heading" className="text-3xl font-bold text-gray-900 mb-2">
              What we do
            </h2>
            <p className="text-gray-600 mb-8 max-w-3xl">
              Three disciplines, one pipeline — from idea to validated, shipped product.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {serviceCards.map((s: any, i: number) => (
                <article key={s.id || s.title || i} className="card flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">{s.name || s.title}</h3>
                    {s.icon && <span className="text-2xl" aria-hidden="true">{s.icon}</span>}
                  </div>
                  <p className="text-gray-600 leading-relaxed flex-1">{s.description}</p>
                  {s.starting_price != null && s.starting_price > 0 && (
                    <p className="mt-3 text-sm font-medium text-blue-600">
                      From ${Number(s.starting_price).toLocaleString()}
                      {s.pricing_model ? ` (${s.pricing_model})` : ""}
                    </p>
                  )}
                  {s.features && s.features.length > 0 && (
                    <ul className="mt-3 text-sm text-gray-600 list-disc list-inside space-y-1">
                      {s.features.slice(0, 4).map((f: string, fi: number) => (
                        <li key={fi}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <Link to={s.to || (s.slug ? `/services/${s.slug}` : "/quote")} className="btn-link mt-4 self-start inline-flex items-center gap-1">
                    {s.cta || "Learn more"} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* Technologies + industries strip */}
          {(technologies.length > 0 || industries.length > 0) && (
            <section className="bg-gray-50" aria-labelledby="stack-heading">
              <div className="max-w-7xl mx-auto px-4 py-16">
                <h2 id="stack-heading" className="text-3xl font-bold text-gray-900 mb-2">
                  Our stack &amp; markets
                </h2>
                <p className="text-gray-600 mb-8 max-w-3xl">
                  The tools we build with, and the industries we solve problems for.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {technologies.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Technologies</h3>
                      <div className="flex flex-wrap gap-2">
                        {technologies.map((t) => (
                          <span key={t.id} className="border border-gray-200 rounded-full px-3 py-1 text-sm bg-white">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {industries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Industries</h3>
                      <div className="flex flex-wrap gap-2">
                        {industries.map((ind) => (
                          <span key={ind.id} className="border border-blue-200 bg-blue-50 text-blue-800 rounded-full px-3 py-1 text-sm">
                            {ind.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Pipeline strip */}
          <section className="bg-slate-900 text-white" aria-labelledby="pipeline-heading">
            <div className="max-w-7xl mx-auto px-4 py-16">
              <h2 id="pipeline-heading" className="text-3xl font-bold mb-2">
                Our innovation pipeline
              </h2>
              <p className="text-gray-300 mb-8 max-w-3xl">
                Every idea at Project Labs travels the same path — so clients know exactly how
                their product gets built.
              </p>
              <ol className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {["Idea", "Research", "Experiment", "Prototype", "Validation", "Development", "Release"].map(
                  (step, i, arr) => (
                    <li key={step} className="flex items-center gap-2">
                      <span className="bg-white/10 border border-gray-400 rounded-full px-4 py-1.5">{step}</span>
                      {i < arr.length - 1 && <span className="text-blue-600" aria-hidden="true">→</span>}
                    </li>
                  )
                )}
              </ol>
              <Link to="/innovation-pipeline" className="btn-link mt-6 inline-flex items-center gap-1 text-blue-600 hover:text-white">
                How our pipeline works <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>

          {/* Latest from the lab */}
          {(research.length > 0 || experiments.length > 0 || blog.length > 0) && (
            <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="lab-heading">
              <h2 id="lab-heading" className="text-3xl font-bold text-gray-900 mb-8">
                Latest from the lab
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {research.slice(0, 1).map((r) => (
                  <article key={r.id} className="card flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Research</span>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{r.title}</h3>
                    {r.abstract && <p className="text-gray-600 text-sm leading-relaxed flex-1">{r.abstract}</p>}
                    {r.status && <span className="mt-3 text-xs text-gray-500">{r.status}</span>}
                    <Link to={`/research/${r.slug}`} className="btn-link mt-3 self-start inline-flex items-center gap-1">
                      Read more <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
                {experiments.slice(0, 1).map((e) => (
                  <article key={e.id} className="card flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Experiment</span>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{e.title}</h3>
                    {e.objective && <p className="text-gray-600 text-sm leading-relaxed flex-1">{e.objective}</p>}
                    {e.status && <span className="mt-3 text-xs text-gray-500">{e.status}</span>}
                    <Link to={`/experiments/${e.slug}`} className="btn-link mt-3 self-start inline-flex items-center gap-1">
                      Read more <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
                {blog.slice(0, 1).map((b) => (
                  <article key={b.id} className="card flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Journal</span>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{b.title}</h3>
                    {b.excerpt && <p className="text-gray-600 text-sm leading-relaxed flex-1">{b.excerpt}</p>}
                    {b.category && <span className="mt-3 text-xs text-gray-500">{b.category}</span>}
                    <Link to={`/blog/${b.slug}`} className="btn-link mt-3 self-start inline-flex items-center gap-1">
                      Read more <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Testimonials */}
          {testimonials.length > 0 && (
            <section className="bg-gray-50" aria-labelledby="testimonial-heading">
              <div className="max-w-7xl mx-auto px-4 py-16">
                <h2 id="testimonial-heading" className="text-3xl font-bold text-gray-900 mb-8">
                  What clients say
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {testimonials.slice(0, 3).map((t) => (
                    <figure key={t.id} className="card">
                      <blockquote className="text-gray-700 leading-relaxed">"{t.content}"</blockquote>
                      <figcaption className="mt-4 text-sm">
                        <span className="font-semibold text-gray-900">{t.name}</span>
                        {t.role && <span className="text-gray-500"> — {t.role}</span>}
                        {t.company && <span className="text-gray-500">, {t.company}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Achievements + partners */}
          {(achievements.length > 0 || partners.length > 0) && (
            <section className="max-w-7xl mx-auto px-4 py-16" aria-labelledby="trust-heading">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {achievements.length > 0 && (
                  <div>
                    <h2 id="trust-heading" className="text-2xl font-bold text-gray-900 mb-4">Milestones</h2>
                    <ul className="space-y-3">
                      {achievements.slice(0, 5).map((a) => (
                        <li key={a.id} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1" aria-hidden="true">◆</span>
                          <div>
                            <p className="font-medium text-gray-900">{a.title}</p>
                            {a.metric && <p className="text-sm text-gray-500">{a.metric}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {partners.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Partners</h2>
                    <ul className="space-y-3">
                      {partners.slice(0, 5).map((p) => (
                        <li key={p.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          {p.partner_type && <span className="text-xs text-gray-500">{p.partner_type}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="max-w-7xl mx-auto px-4 py-16">
            <div className="card text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Have a project in mind?</h2>
              <p className="text-gray-600 mb-8 max-w-xl mx-auto">
                Tell us what you want to build — or share an idea you would like to validate — and
                our team will respond with a tailored proposal.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/quote" className="btn-primary">
                  Get a Quote
                </Link>
                <Link to="/start-a-project" className="btn-secondary">
                  Start a Project
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default Home