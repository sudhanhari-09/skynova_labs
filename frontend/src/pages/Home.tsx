import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  fetchPublicSite,
  fetchServices,
  fetchPublicProjects,
  fetchResearch,
  fetchExperiments,
  fetchJournalArticles,
  fetchTestimonials,
  fetchAchievements,
  fetchPartners,
  Service,
  JournalArticle,
  PublicProject,
} from "../services/api"
import { Skeleton } from "../components/ui"

const focusAreas = [
  {
    icon: "🔬",
    title: "Research",
    description:
      "Applied research across software engineering, AI and emerging technologies — validating ideas before they become products.",
    to: "/research",
    cta: "Explore research",
  },
  {
    icon: "⚗️",
    title: "Experiments",
    description:
      "Hands-on prototypes and proof-of-concepts that de-risk new technology before production investment.",
    to: "/experiments",
    cta: "See experiments",
  },
  {
    icon: "🚀",
    title: "Product Engineering",
    description:
      "Web, mobile, AI/ML and automation solutions taken from discovery through estimation to disciplined delivery.",
    to: "/projects",
    cta: "View projects",
  },
]

const Home: React.FC = () => {
  const [hero, setHero] = useState({
    eyebrow: "Technology Research & Development",
    title: "We turn ambitious ideas into production-ready products.",
    subtitle: "SkyNova Project Labs is the innovation engine of SkyNova — combining research, experimentation and disciplined engineering to build software that solves real problems.",
  })
  const [services, setServices] = useState<Service[]>([])
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [research, setResearch] = useState<any[]>([])
  const [experiments, setExperiments] = useState<any[]>([])
  const [blog, setBlog] = useState<JournalArticle[]>([])
  const [testimonials, setTestimonials] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const [site, svc, prj, res, exp, b, ts, ac, p] = await Promise.all([
        fetchPublicSite().catch(() => null),
        fetchServices().catch(() => []),
        fetchPublicProjects({ limit: 3 }).catch(() => ({ projects: [] as PublicProject[], total: 0 })),
        fetchResearch().catch(() => []),
        fetchExperiments().catch(() => []),
        fetchJournalArticles().catch(() => []),
        fetchTestimonials().catch(() => []),
        fetchAchievements().catch(() => []),
        fetchPartners().catch(() => []),
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
      setProjects(prj.projects)
      setResearch(res)
      setExperiments(exp)
      setBlog(b)
      setTestimonials(ts)
      setAchievements(ac)
      setPartners(p)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const serviceCards: any[] = services.length > 0 ? services : focusAreas

  const activeExperiments = experiments.filter((e: any) =>
    ["active", "running", "testing", "validating"].includes((e.status || "").toLowerCase())
  )
  const experimentPreview = activeExperiments.length > 0 ? activeExperiments : experiments

  const formatShortDate = (d?: string | null): string => {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
  }

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
        <section className="max-w-7xl mx-auto site-container py-16">
          <Skeleton className="h-6 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </section>
      ) : (
        <>
          {/* What We Do */}
          <section className="max-w-7xl mx-auto site-container py-16" aria-labelledby="what-we-do">
            <h2 id="what-we-do" className="text-3xl font-bold text-gray-900 mb-2">
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
                  <Link to={s.to || (s.slug ? `/services/${s.slug}` : "/quote")} className="btn-link mt-4 self-start inline-flex items-center gap-1">
                    {s.cta || "Learn more"} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* Innovation Pipeline */}
          <section className="bg-slate-900 text-white" aria-labelledby="pipeline-heading">
            <div className="max-w-7xl mx-auto site-container py-16">
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

          {/* Preview: Featured projects */}
          {projects.length > 0 && (
            <section className="home-preview site-container" aria-labelledby="home-projects-heading">
              <div className="home-preview__head">
                <div>
                  <h2 id="home-projects-heading" className="home-preview__title">Featured projects</h2>
                  <p className="home-preview__intro">Selected product builds from our portfolio.</p>
                </div>
                <Link to="/projects" className="home-preview__link">View all projects →</Link>
              </div>
              <div className="home-preview__grid">
                {projects.slice(0, 3).map((pr) => (
                  <Link key={pr.project_number} to={`/project/${pr.project_number}`} className="home-preview-card home-preview-card--projects">
                    <span className="home-preview-card__eyebrow">{pr.project_number}</span>
                    <h3 className="home-preview-card__title">{pr.title}</h3>
                    {pr.description && (
                      <p className="home-preview-card__text">
                        {pr.description.length > 110 ? pr.description.slice(0, 110) + "..." : pr.description}
                      </p>
                    )}
                    <span className="home-preview-card__meta">
                      <span className="home-preview-card__badge">{pr.status.replace(/_/g, " ")}</span>
                      <span>{formatShortDate(pr.start_date)}</span>
                    </span>
                    <span className="home-preview-card__cta">View project →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Preview: Latest research */}
          {research.length > 0 && (
            <section className="home-preview site-container" aria-labelledby="home-research-heading">
              <div className="home-preview__head">
                <div>
                  <h2 id="home-research-heading" className="home-preview__title">Latest research</h2>
                  <p className="home-preview__intro">Recent findings from the research program.</p>
                </div>
                <Link to="/research" className="home-preview__link">Explore research →</Link>
              </div>
              <div className="home-preview__grid">
                {research.slice(0, 2).map((r: any) => (
                  <Link key={r.id} to={`/research/${r.slug}`} className="home-preview-card home-preview-card--research">
                    <span className="home-preview-card__eyebrow">{r.category || "Research"}</span>
                    <h3 className="home-preview-card__title">{r.title}</h3>
                    {(r.abstract || r.description) && (
                      <p className="home-preview-card__text">
                        {((r.abstract || r.description) || "").length > 110
                          ? (r.abstract || r.description || "").slice(0, 110) + "..."
                          : (r.abstract || r.description)}
                      </p>
                    )}
                    <span className="home-preview-card__meta">
                      <span className="home-preview-card__badge">{(r.status || "Proposed").replace(/_/g, " ")}</span>
                    </span>
                    <span className="home-preview-card__cta">Read the brief →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Preview: Active experiments */}
          {experimentPreview.length > 0 && (
            <section className="home-preview site-container" aria-labelledby="home-experiments-heading">
              <div className="home-preview__head">
                <div>
                  <h2 id="home-experiments-heading" className="home-preview__title">Active experiments</h2>
                  <p className="home-preview__intro">Live validations running in the lab.</p>
                </div>
                <Link to="/experiments" className="home-preview__link">Explore experiments →</Link>
              </div>
              <div className="home-preview__grid">
                {experimentPreview.slice(0, 2).map((e: any) => (
                  <Link key={e.id} to={`/experiments/${e.slug}`} className="home-preview-card home-preview-card--experiments">
                    <span className="home-preview-card__eyebrow">Experiment</span>
                    <h3 className="home-preview-card__title">{e.title}</h3>
                    {(e.objective || e.hypothesis) && (
                      <p className="home-preview-card__text">
                        {((e.objective || e.hypothesis) || "").length > 110
                          ? (e.objective || e.hypothesis || "").slice(0, 110) + "..."
                          : (e.objective || e.hypothesis)}
                      </p>
                    )}
                    <span className="home-preview-card__meta">
                      <span className="home-preview-card__badge">{(e.status || "Planning").replace(/_/g, " ")}</span>
                    </span>
                    <span className="home-preview-card__cta">View experiment →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Preview: Latest journal */}
          {blog.length > 0 && (
            <section className="home-preview site-container" aria-labelledby="home-blog-heading">
              <div className="home-preview__head">
                <div>
                  <h2 id="home-blog-heading" className="home-preview__title">Latest journal</h2>
                  <p className="home-preview__intro">Stories and technical notes from the team.</p>
                </div>
                <Link to="/blog" className="home-preview__link">Read journal →</Link>
              </div>
              <div className="home-preview__grid">
                {blog.slice(0, 3).map((b) => (
                  <Link key={b.id} to={`/blog/${b.slug}`} className="home-preview-card home-preview-card--journal">
                    <span className="home-preview-card__eyebrow">{b.category || "Journal"}</span>
                    <h3 className="home-preview-card__title">{b.title}</h3>
                    {b.excerpt && (
                      <p className="home-preview-card__text">
                        {b.excerpt.length > 110 ? b.excerpt.slice(0, 110) + "..." : b.excerpt}
                      </p>
                    )}
                    <span className="home-preview-card__cta">Read article →</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {testimonials.length > 0 && (
            <section className="bg-gray-50" aria-labelledby="testimonial-heading">
              <div className="max-w-7xl mx-auto site-container py-16">
                <h2 id="testimonial-heading" className="text-3xl font-bold text-gray-900 mb-8">
                  What clients say
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {testimonials.slice(0, 3).map((t) => (
                    <figure key={t.id} className="card">
                      <blockquote className="text-gray-700 leading-relaxed">"{t.content}"</blockquote>
                      <figcaption className="mt-4 text-sm">
                        <span className="font-semibold text-gray-900">{t.name}</span>
                        {t.company && <span className="text-gray-500"> — {t.company}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Achievements + partners */}
          {(achievements.length > 0 || partners.length > 0) && (
            <section className="max-w-7xl mx-auto site-container py-16" aria-labelledby="trust-heading">
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
                            {a.description && <p className="text-sm text-gray-500">{a.description}</p>}
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
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="max-w-7xl mx-auto site-container py-16">
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
