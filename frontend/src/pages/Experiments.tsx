import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchExperiments, Experiment } from "../services/api"

const STATUS_OPTIONS = ["All", "PLANNING", "ACTIVE", "TESTING", "COMPLETED", "ARCHIVED"]

// Terminal states: experiments that produced (or stopped producing) results.
const TERMINAL = new Set(["COMPLETED", "SUCCESSFUL", "FAILED", "ARCHIVED"])

function statusClass(status: string): string {
  const s = (status || "").toLowerCase().replace(/[_\s]/g, "")
  if (["active", "running", "inlab"].includes(s)) return "experiment-card__status--active"
  if (["testing", "validating", "verifying"].includes(s)) return "experiment-card__status--testing"
  if (["completed", "successful", "done"].includes(s)) return "experiment-card__status--completed"
  if (["failed", "cancelled", "canceled"].includes(s)) return "experiment-card__status--failed"
  if (["archived"].includes(s)) return "experiment-card__status--archived"
  return "experiment-card__status--planning"
}

function statusLabel(status: string | null | undefined, fallback = "Planning"): string {
  return (status || fallback).replace(/_/g, " ")
}

const Experiments: React.FC = () => {
  const [items, setItems] = useState<Experiment[] | null>(null)
  const [activeStatus, setActiveStatus] = useState("All")
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    fetchExperiments()
      .then((data) => { setItems(data); setLoadError(false) })
      .catch(() => { setItems([]); setLoadError(true) })
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

  const activeItems = filteredItems.filter((e) => !TERMINAL.has((e.status || "").toUpperCase()))
  const completedItems = filteredItems.filter((e) => TERMINAL.has((e.status || "").toUpperCase()))

  const activeTotal = items ? items.filter((e) => !TERMINAL.has((e.status || "").toUpperCase())).length : 0
  const completedTotal = items ? items.filter((e) => TERMINAL.has((e.status || "").toUpperCase())).length : 0
  const testingTotal = items ? items.filter((e) => ["TESTING", "VALIDATING"].includes((e.status || "").toUpperCase())).length : 0

  const clearFilters = () => setActiveStatus("All")

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
            <>
              <div className="experiments-hero__pipeline">
                {[
                  { label: "Hypothesis", active: true },
                  { label: "In the Lab", active: activeTotal > 0 },
                  { label: "Testing", active: testingTotal > 0 },
                  { label: "Results", active: completedTotal > 0 },
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
              <div className="experiments-hero__stats">
                <div className="experiments-hero__stat">
                  <span className="experiments-hero__stat-value">{items.length}</span>
                  <span className="experiments-hero__stat-label">Total Experiments</span>
                </div>
                <div className="experiments-hero__stat">
                  <span className="experiments-hero__stat-value">{activeTotal}</span>
                  <span className="experiments-hero__stat-label">In the Lab</span>
                </div>
                <div className="experiments-hero__stat">
                  <span className="experiments-hero__stat-value">{testingTotal}</span>
                  <span className="experiments-hero__stat-label">Testing</span>
                </div>
                <div className="experiments-hero__stat">
                  <span className="experiments-hero__stat-value">{completedTotal}</span>
                  <span className="experiments-hero__stat-label">Results</span>
                </div>
              </div>
            </>
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
                aria-pressed={activeStatus === s}
                className={`experiments-status-btn ${activeStatus === s ? "experiments-status-btn--active" : ""}`}
              >
                {s === "All" ? "All Experiments" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="experiments-empty experiments-empty--error" role="alert">
            <h2 className="experiments-empty__title">We couldn’t load the experiment log</h2>
            <p>The lab service is temporarily unavailable. Please try again shortly.</p>
            <button type="button" onClick={load} className="btn-primary" style={{ marginTop: "1rem" }}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {!loadError && items === null && (
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
        {!loadError && items && filteredItems.length === 0 && (
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
              <button onClick={clearFilters} className="btn-primary" style={{ marginTop: "1rem" }}>
                Show All Experiments
              </button>
            )}
          </div>
        )}

        {/* In the Lab — active experiments */}
        {!loadError && activeItems.length > 0 && (
          <section className="experiments-group experiments-group--active" aria-labelledby="exp-active-heading">
            <div className="experiments-group__head">
              <div>
                <span className="experiments-section-label">In the Lab</span>
                <h2 id="exp-active-heading" className="experiments-group__title">Active experiments</h2>
              </div>
              <p className="experiments-group__desc">
                Experiments that are currently planned or running — from hypothesis through testing.
              </p>
            </div>
            <div className="experiments-grid">
              {activeItems.map((item) => (
                <Link key={item.id} to={`/experiments/${item.slug}`} className="experiment-card">
                  <div className="experiment-card__header">
                    <span className={`experiment-card__status ${statusClass(item.status || "")}`}>
                      <span className="experiment-card__status-led" aria-hidden="true" />
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <h3 className="experiment-card__title">{item.title}</h3>
                  {(item.objective || item.hypothesis || item.description) && (
                    <p className="experiment-card__objective">
                      {((item.objective || item.hypothesis || item.description) || "").length > 150
                        ? (item.objective || item.hypothesis || item.description || "").slice(0, 150) + "..."
                        : (item.objective || item.hypothesis || item.description)}
                    </p>
                  )}
                  {item.technologies && item.technologies.length > 0 && (
                    <div className="experiment-card__tech">
                      {item.technologies.slice(0, 4).map((t) => <span key={t} className="experiment-card__tech-tag">{t}</span>)}
                      {item.technologies.length > 4 && <span className="experiment-card__tech-tag">+{item.technologies.length - 4}</span>}
                    </div>
                  )}
                  <div className="experiment-card__footer">
                    <span />
                    <span className="experiment-card__arrow">View experiment →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Results: completed experiments */}
        {!loadError && completedItems.length > 0 && (
          <section className="experiments-group experiments-group--results" aria-labelledby="exp-results-heading">
            <div className="experiments-group__head">
              <div>
                <span className="experiments-section-label">Results</span>
                <h2 id="exp-results-heading" className="experiments-group__title">Completed experiments</h2>
              </div>
              <p className="experiments-group__desc">
                Experiments with recorded outcomes — conclusions, next steps and validated or disproven hypotheses.
              </p>
            </div>
            <div className="experiments-grid">
              {completedItems.map((item) => (
                <Link key={item.id} to={`/experiments/${item.slug}`} className="experiment-card">
                  <div className="experiment-card__header">
                    <span className={`experiment-card__status ${statusClass(item.status || "")}`}>
                      <span className="experiment-card__status-led" aria-hidden="true" />
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <h3 className="experiment-card__title">{item.title}</h3>
                  {(item.conclusion || item.results || item.objective) && (
                    <p className="experiment-card__objective">
                      {((item.conclusion || item.results || item.objective) || "").length > 150
                        ? (item.conclusion || item.results || item.objective || "").slice(0, 150) + "..."
                        : (item.conclusion || item.results || item.objective)}
                    </p>
                  )}
                  <div className="experiment-card__footer">
                    <span />
                    <span className="experiment-card__arrow">See results →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Experiment library index */}
        {!loadError && filteredItems.length > 0 && (
          <section className="experiments-library" aria-labelledby="exp-library-heading">
            <div className="experiments-group__head">
              <div>
                <span className="experiments-section-label">Experiment Library</span>
                <h2 id="exp-library-heading" className="experiments-group__title">All experiments</h2>
              </div>
            </div>
            <div className="experiment-index">
              {filteredItems.map((item) => (
                <Link key={item.id} to={`/experiments/${item.slug}`} className="experiment-index__row">
                  <span className={`experiment-index__status ${statusClass(item.status || "")}`}>
                    {statusLabel(item.status)}
                  </span>
                  <span className="experiment-index__main">
                    <span className="experiment-index__title">{item.title}</span>
                    {(item.objective || item.description) && (
                      <span className="experiment-index__meta">
                        {(item.objective || item.description || "").length > 90
                          ? (item.objective || item.description || "").slice(0, 90) + "..."
                          : (item.objective || item.description)}
                      </span>
                    )}
                  </span>
                  <span className="experiment-index__arrow">Open →</span>
                </Link>
              ))}
            </div>
          </section>
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
