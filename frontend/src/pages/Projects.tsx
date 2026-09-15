import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPublicProjects, PublicProject } from "../services/api"

const processSteps = [
  { step: "01", title: "Discovery & Analysis", body: "Requirements capture, system review, and scope definition aligned to business outcomes." },
  { step: "02", title: "Estimation & Proposal", body: "Technical analysis followed by a transparent quotation covering timeline, budget and deliverables." },
  { step: "03", title: "Milestone Delivery", body: "Iterative development with milestone tracking, progress updates, and quality gates at every stage." },
  { step: "04", title: "Ship & Iterate", body: "Production deployment, monitoring and post-release improvement built into every engagement." },
]

function statusTone(status: string): string {
  const s = (status || "").toLowerCase().replace(/[_\s]/g, "")
  if (["active", "inprogress", "delivery", "development"].includes(s)) return "project-card__status--active"
  if (["completed", "done", "shipped"].includes(s)) return "project-card__status--completed"
  if (["planning", "onhold", "proposed", "pending"].includes(s)) return "project-card__status--planning"
  if (["cancelled", "canceled"].includes(s)) return "project-card__status--cancelled"
  return "project-card__status--active"
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

const Projects: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PublicProject[] | null>(null)
  const [statusFilter, setStatusFilter] = useState("All")
  const [query, setQuery] = useState("")
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    fetchPublicProjects({ limit: 100 })
      .then((res) => {
        setPortfolio(res.projects)
        setLoadError(false)
      })
      .catch(() => {
        setPortfolio([])
        setLoadError(true)
      })
  }, [])
  useEffect(() => { load() }, [load])

  const statusOptions = useMemo(() => {
    if (!portfolio) return []
    const labels = new Set<string>()
    portfolio.forEach((p) => {
      const raw = (p.status || "").trim()
      if (raw) labels.add(raw.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    })
    return ["All", ...Array.from(labels)]
  }, [portfolio])

  const filtered = useMemo(() => {
    if (!portfolio) return []
    const q = query.trim().toLowerCase()
    return portfolio.filter((p) => {
      if (statusFilter !== "All" && (p.status || "").toLowerCase().replace(/_/g, " ") !== statusFilter.toLowerCase()) return false
      if (!q) return true
      return [p.title, p.acronym, p.description, p.project_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [portfolio, statusFilter, query])

  const activeCount = portfolio ? portfolio.filter((p) => {
    const s = (p.status || "").toLowerCase()
    return s === "active" || s === "in_progress" || s === "in progress" || s === "delivery"
  }).length : 0
  const completedCount = portfolio ? portfolio.filter((p) => {
    const s = (p.status || "").toLowerCase()
    return s === "completed" || s === "done" || s === "shipped"
  }).length : 0

  const clearFilters = () => { setStatusFilter("All"); setQuery("") }

  return (
    <div className="projects-page">
      {/* Hero */}
      <section className="projects-hero">
        <div className="projects-hero__inner">
          <span className="projects-hero__eyebrow">Project Portfolio</span>
          <h1 className="projects-hero__title">
            Engineering solutions that move from concept to production
          </h1>
          <p className="projects-hero__subtitle">
            Every engagement follows a disciplined process — discovery, estimation,
            and milestone-driven delivery — so clients know exactly how their product gets built.
          </p>
          {portfolio && portfolio.length > 0 && (
            <div className="projects-hero__stats">
              <div>
                <div className="projects-hero__stat-value">{portfolio.length}</div>
                <div className="projects-hero__stat-label">Total Projects</div>
              </div>
              <div>
                <div className="projects-hero__stat-value">{activeCount}</div>
                <div className="projects-hero__stat-label">Active Now</div>
              </div>
              <div>
                <div className="projects-hero__stat-value">{completedCount}</div>
                <div className="projects-hero__stat-label">Completed</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="projects-content">
        {/* Filtering toolbar */}
        <div className="projects-toolbar">
          <div className="projects-toolbar__filters" role="group" aria-label="Filter projects by status">
            {statusOptions.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setStatusFilter(label)}
                aria-pressed={statusFilter === label}
                className={`projects-toolbar__status-btn ${statusFilter === label ? "projects-toolbar__status-btn--active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="projects-toolbar__search">
            <span className="sr-only">Search projects</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects by name…"
              aria-label="Search projects"
            />
          </label>
        </div>

        {/* Loading */}
        {portfolio === null && (
          <div>
            <span className="projects-section-label">Current Portfolio</span>
            <div className="projects-grid" style={{ opacity: 0.5 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="project-card animate-pulse" style={{ minHeight: 180 }}>
                  <div style={{ height: "0.75rem", background: "#E5E9F0", borderRadius: 4, width: "30%", marginBottom: "0.75rem" }} />
                  <div style={{ height: "1rem", background: "#E5E9F0", borderRadius: 4, width: "70%", marginBottom: "0.5rem" }} />
                  <div style={{ height: "0.75rem", background: "#EEF1F6", borderRadius: 4, width: "90%" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="projects-empty projects-empty--error" role="alert">
            <h2 className="projects-empty__title">We couldn’t load the project portfolio</h2>
            <p>Our portfolio service is temporarily unavailable. Please try again shortly.</p>
            <button type="button" onClick={load} className="btn-primary" style={{ marginTop: "1rem" }}>
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loadError && portfolio && filtered.length === 0 && (
          <div className="projects-empty">
            <h2 className="projects-empty__title">
              {statusFilter !== "All" || query ? "No projects match your filters" : "No projects to display yet"}
            </h2>
            <p>
              {statusFilter !== "All" || query
                ? "Try a different status or search term to find what you’re looking for."
                : "We are building our portfolio. Check back soon to see our latest work."}
            </p>
            {(statusFilter !== "All" || query) && (
              <button type="button" onClick={clearFilters} className="btn-primary" style={{ marginTop: "1rem" }}>
                Show All Projects
              </button>
            )}
          </div>
        )}

        {/* Portfolio grid */}
        {!loadError && filtered.length > 0 && (
          <div>
            <span className="projects-section-label">
              Current Portfolio{statusFilter !== "All" || query ? ` · ${filtered.length} ${filtered.length === 1 ? "project" : "projects"}` : ""}
            </span>
            <div className="projects-grid">
              {filtered.map((p) => (
                <Link
                  key={p.project_number}
                  to={`/project/${p.project_number}`}
                  className="project-card"
                >
                  <div className="project-card__header">
                    <span className="project-card__number">{p.project_number}</span>
                    <span className={`project-card__status ${statusTone(p.status)}`}>
                      {(p.status || "Active").replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="project-card__title">{p.title}</h3>
                  {p.acronym && <p className="project-card__acronym">{p.acronym}</p>}
                  {p.description && (
                    <p className="project-card__desc">
                      {p.description.length > 140 ? p.description.slice(0, 140) + "..." : p.description}
                    </p>
                  )}
                  <div className="project-card__meta">
                    <span className="project-card__date">
                      {formatDate(p.start_date)}
                      {p.target_end_date ? ` — ${formatDate(p.target_end_date)}` : ""}
                    </span>
                    <span className="project-card__arrow">View details →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Development process */}
        {!loadError && (
          <section className="projects-process" aria-labelledby="projects-process-heading">
            <span className="projects-section-label">Development Process</span>
            <h2 id="projects-process-heading" className="projects-process__heading">
              How every project gets built
            </h2>
            <div className="projects-process__timeline">
              {processSteps.map((s) => (
                <div key={s.step} className="projects-process__card">
                  <div className="projects-process__step">Step {s.step}</div>
                  <h3 className="projects-process__title">{s.title}</h3>
                  <p className="projects-process__desc">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="projects-cta">
          <h2 className="projects-cta__title">Have a project in mind?</h2>
          <p className="projects-cta__text">
            Tell us what you want to build — or share an idea you want to validate — and our team
            will respond with a tailored proposal.
          </p>
          <div className="projects-cta__actions">
            <Link to="/quote" className="btn-primary">Get a Quote</Link>
            <Link to="/start-a-project" className="btn-secondary">Start a Project</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Projects
