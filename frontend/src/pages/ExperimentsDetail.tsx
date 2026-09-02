import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fetchExperimentBySlug, Experiment } from "../services/api"

function statusLabel(status: string | undefined): string {
  return (status || "Planning").replace(/_/g, " ")
}

const ExperimentsDetail: React.FC = () => {
  const { slug = "" } = useParams()
  const [item, setItem] = useState<Experiment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExperimentBySlug(slug)
      .then(setItem)
      .catch((e) => setError(String(e?.message || e || "Experiment not found")))
  }, [slug])

  if (error) {
    return (
      <div className="experiment-detail-page">
        <div className="experiment-detail-hero">
          <div className="experiment-detail-hero__inner">
            <Link to="/experiments" className="experiment-detail-hero__back">← Back to Experiments</Link>
            <h1 className="experiment-detail-hero__title">Experiment Not Found</h1>
            <p className="experiment-detail-hero__desc">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="experiment-detail-page">
        <div className="experiment-detail-hero">
          <div className="experiment-detail-hero__inner">
            <div style={{ height: "0.75rem", background: "rgba(255,255,255,0.1)", borderRadius: 4, width: "30%", marginBottom: "1rem" }} />
            <div style={{ height: "2rem", background: "rgba(255,255,255,0.1)", borderRadius: 4, width: "70%", marginBottom: "0.75rem" }} />
            <div style={{ height: "1rem", background: "rgba(255,255,255,0.06)", borderRadius: 4, width: "50%" }} />
          </div>
        </div>
      </div>
    )
  }

  const sections: { label: string; value?: string | null }[] = [
    { label: "Objective", value: item.objective },
    { label: "Hypothesis", value: item.hypothesis },
    { label: "Procedure", value: item.procedure },
    { label: "Observations", value: item.observations },
    { label: "Results", value: item.results },
    { label: "Conclusion", value: item.conclusion },
    { label: "Next Steps", value: item.next_step },
  ].filter((f) => f.value)

  return (
    <div className="experiment-detail-page">
      {/* Hero */}
      <header className="experiment-detail-hero">
        <div className="experiment-detail-hero__inner">
          <Link to="/experiments" className="experiment-detail-hero__back">← Back to Experiments</Link>
          <div className="experiment-detail-hero__status">{statusLabel(item.status)}</div>
          <h1 className="experiment-detail-hero__title">{item.title}</h1>
          {item.description && <p className="experiment-detail-hero__desc">{item.description}</p>}
        </div>
      </header>

      {/* Body */}
      <div className="experiment-detail-body">
        {sections.map((s) => (
          <div key={s.label} className="experiment-detail-section">
            <h2 className="experiment-detail-section__title">{s.label}</h2>
            <p className="experiment-detail-section__text">{s.value}</p>
          </div>
        ))}

        {item.technologies && item.technologies.length > 0 && (
          <div className="experiment-detail-tech">
            {item.technologies.map((t) => (
              <span key={t} className="experiment-detail-tech__tag">{t}</span>
            ))}
          </div>
        )}

        {item.components && item.components.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>Components</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {item.components.map((c) => (
                <span key={c} style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.75rem", borderRadius: 999, background: "#F3F4F6", color: "var(--text-secondary)" }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExperimentsDetail
