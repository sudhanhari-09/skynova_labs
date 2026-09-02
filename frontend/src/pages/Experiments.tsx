import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchExperiments, Experiment } from "../services/api"

const STATUS_OPTIONS = ["All", "PLANNING", "ACTIVE", "TESTING", "COMPLETED", "ARCHIVED"]

function statusClass(status: string): string {
  const s = (status || "").toLowerCase()
  if (s === "active") return "experiment-card__status--active"
  if (s === "testing" || s === "validating") return "experiment-card__status--testing"
  if (s === "completed") return "experiment-card__status--completed"
  if (s === "archived") return "experiment-card__status--archived"
  return "experiment-card__status--planning"
}

const Experiments: React.FC = () => {
  const [items, setItems] = useState<Experiment[] | null>(null)
  const [activeStatus, setActiveStatus] = useState("All")

  const load = useCallback(() => {
    fetchExperiments()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

  const usedStatuses = useMemo(() => {
    if (!items) return []
    const statuses = new Set(items.map((e) => (e.status || "").toUpperCase()).filter(Boolean))
    return STATUS_OPTIONS.filter((s) => s === "All" || statuses.has(s))
  }, [items])

  const filteredItems = useMemo(() => {
    if (!items) return []
    if (activeStatus === "All") return items
    return items.filter((e) => (e.status || "").toUpperCase() === activeStatus)
  }, [items, activeStatus])

  const activeCount = items ? items.filter((e) => (e.status || "").toLowerCase() === "active").length : 0
  const completedCount = items ? items.filter((e) => (e.status || "").toLowerCase() === "completed").length : 0

  return (
    <div className="experiments-page">
      {/* Hero */}
      <section className="experiments-hero">
        <div className="experiments-hero__inner">
          <span className="experiments-hero__eyebrow">Experiments Lab</span>
          <h1 className="experiments-hero__title">
            Testing ideas, validating technology, de-risking the future
          </h1>
          <p className="experiments-hero__subtitle">
            Hands-on prototypes, proof-of-concepts and technical validations —
            each experiment follows a structured process from hypothesis to conclusion.
          </p>
          {items && items.length > 0 && (
            <div className="experiments-hero__pipeline">
              {[
                { label: "Hypothesis", active: true },
                { label: "Active", active: activeCount > 0 },
                { label: "Testing", active: false },
                { label: "Results", active: completedCount > 0 },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div className="experiments-hero__pipeline-step">
                    <span className={`experiments-hero__pipeline-dot ${step.active ? "experiments-hero__pipeline-dot--active" : ""}`} />
                    {step.label}
                  </div>
                  {i < arr.length - 1 && <span className="experiments-hero__pipeline-arrow">→</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="experiments-content">
        {/* Status filters */}
        {usedStatuses.length > 1 && (
          <div className="experiments-status-filters">
            {usedStatuses.map((s) => (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={`experiments-status-btn ${activeStatus === s ? "experiments-status-btn--active" : ""}`}
              >
                {s === "All" ? "All Experiments" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {items === null && (
          <div className="experiments-grid">
            {[1, 2].map((i) => (
              <div key={i} className="experiment-card animate-pulse" style={{ minHeight: 200 }}>
                <div style={{ height: "0.75rem", background: "#E5E9F0", borderRadius: 4, width: "30%", marginBottom: "0.75rem" }} />
                <div style={{ height: "1rem", background: "#E5E9F0", borderRadius: 4, width: "70%", marginBottom: "0.5rem" }} />
                <div style={{ height: "0.75rem", background: "#EEF1F6", borderRadius: 4, width: "90%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {items && filteredItems.length === 0 && (
          <div className="experiments-empty">
            <h2 className="experiments-empty__title">
              {activeStatus !== "All" ? "No experiments in this status" : "No experiments published yet"}
            </h2>
            <p>
              {activeStatus !== "All"
                ? "Try selecting a different status filter, or view all experiments."
                : "Our lab is gearing up. Experiments will appear here once they are running."}
            </p>
            {activeStatus !== "All" && (
              <button onClick={() => setActiveStatus("All")} className="btn-primary" style={{ marginTop: "1rem" }}>
                Show All Experiments
              </button>
            )}
          </div>
        )}

        {/* Experiment cards */}
        {filteredItems.length > 0 && (
          <div className="experiments-grid">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                to={`/experiments/${item.slug}`}
                className="experiment-card"
              >
                <div className="experiment-card__header">
                  <span className={`experiment-card__status ${statusClass(item.status || "")}`}>
                    {(item.status || "Planning").replace(/_/g, " ")}
                  </span>
                </div>
                <h3 className="experiment-card__title">{item.title}</h3>
                {(item.objective || item.description) && (
                  <p className="experiment-card__objective">
                    {((item.objective || item.description) || "").length > 150
                      ? (item.objective || item.description || "").slice(0, 150) + "..."
                      : (item.objective || item.description)}
                  </p>
                )}
                {item.technologies && item.technologies.length > 0 && (
                  <div className="experiment-card__tech">
                    {item.technologies.slice(0, 4).map((t) => (
                      <span key={t} className="experiment-card__tech-tag">{t}</span>
                    ))}
                    {item.technologies.length > 4 && (
                      <span className="experiment-card__tech-tag">+{item.technologies.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="experiment-card__footer">
                  <span />
                  <span className="experiment-card__arrow">View experiment →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="experiments-cta">
          <h2 className="experiments-cta__title">Want to validate a technology idea?</h2>
          <p className="experiments-cta__text">
            We design experiments to answer specific technical questions before
            committing to a full build. Let us help de-risk your next initiative.
          </p>
          <div className="experiments-cta__actions">
            <Link to="/quote" className="btn-primary">Start an Experiment</Link>
            <Link to="/research" className="btn-secondary">Explore Research</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Experiments
