import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchResearch } from "../services/api"
import type { Research } from "../services/api"

const researchAreas = ["All", "Machine Learning", "Software Architecture", "Prototyping", "IoT", "Data Engineering", "Computer Vision", "NLP"]

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

const Research: React.FC = () => {
  const [items, setItems] = useState<Research[] | null>(null)
  const [activeArea, setActiveArea] = useState("All")

  const load = useCallback(() => {
    fetchResearch()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    if (!items) return []
    const cats = new Set(items.map((r) => r.category).filter(Boolean) as string[])
    return Array.from(cats)
  }, [items])

  const filteredItems = useMemo(() => {
    if (!items) return []
    if (activeArea === "All") return items
    return items.filter((r) => r.category === activeArea)
  }, [items, activeArea])

  return (
    <div className="research-page">
      {/* Hero */}
      <section className="research-hero">
        <div className="research-hero__inner">
          <span className="research-hero__eyebrow">Applied Research</span>
          <h1 className="research-hero__title">
            Investigating the technologies that shape what we build
          </h1>
          <p className="research-hero__subtitle">
            Our research program validates ideas through systematic investigation —
            applying rigorous methodology to software engineering, AI and emerging technologies.
            Findings directly inform the products and solutions we deliver.
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="research-content">
        {/* Research areas filter */}
        {categories.length > 0 && (
          <>
            <span className="research-section-label">Research Areas</span>
            <div className="research-areas">
              {["All", ...categories].map((area) => (
                <button
                  key={area}
                  onClick={() => setActiveArea(area)}
                  className={`research-area-btn ${activeArea === area ? "research-area-btn--active" : ""}`}
                >
                  {area}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Loading */}
        {items === null && (
          <div className="research-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="research-card animate-pulse" style={{ minHeight: 200 }}>
                <div style={{ height: "0.75rem", background: "#E5E9F0", borderRadius: 4, width: "40%", marginBottom: "0.75rem" }} />
                <div style={{ height: "1rem", background: "#E5E9F0", borderRadius: 4, width: "75%", marginBottom: "0.5rem" }} />
                <div style={{ height: "0.75rem", background: "#EEF1F6", borderRadius: 4, width: "90%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {items && filteredItems.length === 0 && (
          <div className="research-empty">
            <h2 className="research-empty__title">
              {activeArea !== "All" ? "No research in this area" : "No research published yet"}
            </h2>
            <p>
              {activeArea !== "All"
                ? "Try selecting a different research area, or explore all topics."
                : "Our research team is actively investigating new topics. Check back soon for findings and publications."}
            </p>
            {activeArea !== "All" && (
              <button onClick={() => setActiveArea("All")} className="btn-primary" style={{ marginTop: "1rem" }}>
                Show All Research
              </button>
            )}
          </div>
        )}

        {/* Research cards */}
        {filteredItems.length > 0 && (
          <div className="research-grid">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                to={`/research/${item.slug}`}
                className="research-card"
              >
                <div className="research-card__badges">
                  {item.category && (
                    <span className="research-card__badge research-card__badge--category">{item.category}</span>
                  )}
                  {item.status && (
                    <span className="research-card__badge research-card__badge--status">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <h3 className="research-card__title">{item.title}</h3>
                {(item.abstract || item.description) && (
                  <p className="research-card__abstract">
                    {((item.abstract || item.description) || "").length > 150
                      ? (item.abstract || item.description || "").slice(0, 150) + "..."
                      : (item.abstract || item.description)}
                  </p>
                )}
                {item.technologies && item.technologies.length > 0 && (
                  <div className="research-card__tech">
                    {item.technologies.slice(0, 4).map((t) => (
                      <span key={t} className="research-card__tech-tag">{t}</span>
                    ))}
                    {item.technologies.length > 4 && (
                      <span className="research-card__tech-tag">+{item.technologies.length - 4}</span>
                    )}
                  </div>
                )}
                <div className="research-card__footer">
                  <span className="research-card__dates">
                    {formatDate(item.start_date)}
                    {item.end_date ? ` — ${formatDate(item.end_date)}` : ""}
                  </span>
                  <span className="research-card__arrow">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="research-cta">
          <h2 className="research-cta__title">Have a research question?</h2>
          <p className="research-cta__text">
            We welcome collaborations on applied research. Share a research question
            and our team will explore whether we can help.
          </p>
          <div className="research-cta__actions">
            <Link to="/quote" className="btn-primary">Bring a Research Question</Link>
            <Link to="/experiments" className="btn-secondary">See Our Experiments</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Research
