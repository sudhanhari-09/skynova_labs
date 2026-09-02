import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPublicProjects, PublicProject } from "../services/api"

const processSteps = [
  { step: "01", title: "Discovery & Analysis", body: "Requirements capture, system review, and scope definition aligned to business outcomes." },
  { step: "02", title: "Estimation & Proposal", body: "Technical analysis followed by a transparent quotation covering timeline, budget and deliverables." },
  { step: "03", title: "Milestone Delivery", body: "Iterative development with milestone tracking, progress updates, and quality gates at every stage." },
]

function statusClass(status: string): string {
  const s = (status || "").toLowerCase()
  if (s === "active" || s === "in_progress" || s === "in progress") return "project-card__status--active"
  if (s === "completed" || s === "done") return "project-card__status--completed"
  if (s === "planning" || s === "on_hold" || s === "on hold") return "project-card__status--planning"
  return "project-card__status--active"
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

const Projects: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PublicProject[] | null>(null)

  const load = useCallback(() => {
    fetchPublicProjects({ limit: 12 })
      .then((res) => setPortfolio(res.projects))
      .catch(() => setPortfolio([]))
  }, [])
  useEffect(() => { load() }, [load])

  const activeCount = portfolio ? portfolio.filter((p) => {
    const s = (p.status || "").toLowerCase()
    return s === "active" || s === "in_progress" || s === "in progress"
  }).length : 0

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
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="projects-content">
        {/* Process */}
        <span className="projects-section-label">Our Process</span>
        <div className="projects-process">
          {processSteps.map((s) => (
            <div key={s.step} className="projects-process__card">
              <div className="projects-process__step">Step {s.step}</div>
              <h3 className="projects-process__title">{s.title}</h3>
              <p className="projects-process__desc">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Portfolio */}
        {portfolio === null ? (
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
        ) : portfolio.length === 0 ? (
          <div className="projects-empty">
            <h2 className="projects-empty__title">No projects to display yet</h2>
            <p>We are building our portfolio. Check back soon to see our latest work.</p>
          </div>
        ) : (
          <div>
            <span className="projects-section-label">Current Portfolio</span>
            <div className="projects-grid">
              {portfolio.map((p) => (
                <Link
                  key={p.project_number}
                  to={`/project/${p.project_number}`}
                  className="project-card"
                >
                  <div className="project-card__header">
                    <span className={`project-card__status ${statusClass(p.status)}`}>
                      {(p.status || "Active").replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="project-card__title">{p.title}</h3>
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
