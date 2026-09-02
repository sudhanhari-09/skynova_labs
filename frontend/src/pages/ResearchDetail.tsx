import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fetchResearchBySlug, Research } from "../services/api"

const ResearchDetail: React.FC = () => {
  const { slug = "" } = useParams()
  const [item, setItem] = useState<Research | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchResearchBySlug(slug)
      .then(setItem)
      .catch((e) => setError(String(e?.message || e || "Research not found")))
  }, [slug])

  if (error) {
    return (
      <div className="research-detail-page">
        <div className="research-detail-hero">
          <div className="research-detail-hero__inner">
            <Link to="/research" className="research-detail-hero__back">← Back to Research</Link>
            <h1 className="research-detail-hero__title">Research Not Found</h1>
            <p className="research-detail-hero__abstract">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="research-detail-page">
        <div className="research-detail-hero">
          <div className="research-detail-hero__inner">
            <div style={{ height: "0.75rem", background: "rgba(255,255,255,0.1)", borderRadius: 4, width: "30%", marginBottom: "1rem" }} />
            <div style={{ height: "2rem", background: "rgba(255,255,255,0.1)", borderRadius: 4, width: "70%", marginBottom: "0.75rem" }} />
            <div style={{ height: "1rem", background: "rgba(255,255,255,0.06)", borderRadius: 4, width: "50%" }} />
          </div>
        </div>
      </div>
    )
  }

  const sections: { label: string; value?: string | null }[] = [
    { label: "Objectives", value: item.objectives },
    { label: "Methodology", value: item.methodology },
    { label: "Results", value: item.results },
  ].filter((f) => f.value)

  return (
    <div className="research-detail-page">
      {/* Hero */}
      <header className="research-detail-hero">
        <div className="research-detail-hero__inner">
          <Link to="/research" className="research-detail-hero__back">← Back to Research</Link>
          <div className="research-detail-hero__badges">
            {item.category && <span className="research-detail-hero__badge">{item.category}</span>}
            {item.industry && <span className="research-detail-hero__badge">{item.industry}</span>}
            {item.status && <span className="research-detail-hero__badge">{item.status.replace(/_/g, " ")}</span>}
          </div>
          <h1 className="research-detail-hero__title">{item.title}</h1>
          {item.abstract && <p className="research-detail-hero__abstract">{item.abstract}</p>}
        </div>
      </header>

      {/* Body */}
      <div className="research-detail-body">
        {(item.start_date || item.end_date) && (
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {[item.start_date, item.end_date].filter(Boolean).map((d) => formatDate(d)).join(" → ")}
          </p>
        )}

        {item.description && (
          <div className="research-detail-section">
            <h2 className="research-detail-section__title">Overview</h2>
            <p className="research-detail-section__text">{item.description}</p>
          </div>
        )}

        {sections.map((s) => (
          <div key={s.label} className="research-detail-section">
            <h2 className="research-detail-section__title">{s.label}</h2>
            <p className="research-detail-section__text">{s.value}</p>
          </div>
        ))}

        {item.technologies && item.technologies.length > 0 && (
          <div className="research-detail-tags">
            {item.technologies.map((t) => (
              <span key={t} className="research-detail-tag">{t}</span>
            ))}
          </div>
        )}

        {item.researchers && item.researchers.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>Researchers</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{item.researchers.join(", ")}</p>
          </div>
        )}

        {item.publication_links && item.publication_links.length > 0 && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.5rem" }}>Publications</h3>
            <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", fontSize: "0.9rem" }}>
              {item.publication_links.map((link, i) => (
                <li key={i} style={{ marginBottom: "0.25rem" }}>
                  <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--brand-primary)", textDecoration: "underline" }}>
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

export default ResearchDetail
