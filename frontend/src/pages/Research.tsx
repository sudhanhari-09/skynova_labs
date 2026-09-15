import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchResearch } from "../services/api"
import type { Research } from "../services/api"

const METHOD_STEPS = [
  { num: "01", title: "Problem Framing", body: "Each program starts with a scoped research question, background review and the hypotheses we intend to test." },
  { num: "02", title: "Study Design", body: "Methodology, metrics and controls are defined up front so findings stay reproducible and comparable across iterations." },
  { num: "03", title: "Investigation", body: "Research runs as structured studies that produce documented evidence — records, tests and technical notes." },
  { num: "04", title: "Publication & Handoff", body: "Findings are written up, published and translated into the experiments and products we build next." },
]

function formatDate(d: string | null | undefined): string {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function researcherName(r: unknown): string {
  if (typeof r === "string") return r
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>
    if (typeof o.name === "string" && typeof o.role === "string") return `${o.name} (${o.role})`
    if (typeof o.name === "string") return o.name
    if (typeof o.full_name === "string") return o.full_name
  }
  return ""
}

const Research: React.FC = () => {
  const [items, setItems] = useState<Research[] | null>(null)
  const [activeArea, setActiveArea] = useState("All")
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(() => {
    fetchResearch()
      .then((data) => { setItems(data); setLoadError(false) })
      .catch(() => { setItems([]); setLoadError(true) })
  }, [])
  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    if (!items) return []
    return Array.from(new Set(items.map((r) => r.category).filter(Boolean) as string[]))
  }, [items])

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>()
    ;(items || []).forEach((r) => {
      if (!r.category) return
      counts.set(r.category, (counts.get(r.category) || 0) + 1)
    })
    return counts
  }, [items])

  const visibleItems = useMemo(() => {
    if (!items) return []
    if (activeArea === "All") return items
    return items.filter((r) => r.category === activeArea)
  }, [items, activeArea])

  const spotlight = visibleItems.length > 0 ? visibleItems[0] : null

  const publications = useMemo(() => {
    const links = new Set<string>()
    ;(items || []).forEach((r) => (r.publication_links || []).forEach((l) => { if (l) links.add(l) }))
    return Array.from(links).slice(0, 12)
  }, [items])

  const researchers = useMemo(() => {
    const names = new Set<string>()
    ;(items || []).forEach((r) => (r.researchers || []).forEach((x) => { const n = researcherName(x); if (n) names.add(n) }))
    return Array.from(names).slice(0, 12)
  }, [items])

  const metaCount = researchers.length > 0
    ? researchers.length
    : (items || []).reduce((acc, r) => acc + ((r.researchers || []).length), 0)

  return (
    <div className="research-page">
      {/* Hero */}
      <section className="research-hero">
        <div className="research-hero__inner">
          <span className="research-hero__eyebrow">Research Program</span>
          <h1 className="research-hero__title">
            Investigating the technologies that shape what we build
          </h1>
          <p className="research-hero__subtitle">
            Our research program validates ideas through systematic investigation —
            applying rigorous methodology to software engineering, AI and emerging technologies.
            Findings directly inform the products and solutions we deliver.
          </p>
          {items && items.length > 0 && (
            <div className="research-hero__meta">
              <span><strong>{items.length}</strong> published programs</span>
              <span><strong>{categories.length}</strong> research areas</span>
              <span><strong>{metaCount}</strong> researchers</span>
            </div>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="research-content">
        {loadError && (
          <div className="research-empty research-empty--error" role="alert">
            <h2 className="research-empty__title">We couldn’t load the research library</h2>
            <p>The research service is temporarily unavailable. Please try again shortly.</p>
            <button type="button" onClick={load} className="btn-primary" style={{ marginTop: "1rem" }}>Retry</button>
          </div>
        )}

        {!loadError && items !== null && visibleItems.length === 0 && (
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

        {/* Research areas */}
        {!loadError && categories.length > 0 && (
          <section className="research-areas" aria-labelledby="research-areas-heading">
            <span id="research-areas-heading" className="research-section-label">Research Areas</span>
            <div className="research-areas__chips" role="group" aria-label="Filter research by area">
              <button
                onClick={() => setActiveArea("All")}
                aria-pressed={activeArea === "All"}
                className={`research-area-btn ${activeArea === "All" ? "research-area-btn--active" : ""}`}
              >
                All <span className="research-area-btn__count">{items?.length ?? 0}</span>
              </button>
              {categories.map((area) => (
                <button
                  key={area}
                  onClick={() => setActiveArea(area)}
                  aria-pressed={activeArea === area}
                  className={`research-area-btn ${activeArea === area ? "research-area-btn--active" : ""}`}
                >
                  {area} <span className="research-area-btn__count">{areaCounts.get(area) ?? 0}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Loading */}
        {!loadError && items === null && (
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

        {/* Spotlight: latest research program */}
        {!loadError && spotlight && (
          <section className="research-spotlight" aria-labelledby="research-spotlight-heading">
            <span className="research-section-label">Latest Research Program</span>
            <Link to={`/research/${spotlight.slug}`} className="research-spotlight__card">
              <div className="research-spotlight__body">
                <div className="research-card__badges">
                  {spotlight.category && <span className="research-card__badge research-card__badge--category">{spotlight.category}</span>}
                  {spotlight.status && <span className="research-card__badge research-card__badge--status">{spotlight.status.replace(/_/g, " ")}</span>}
                </div>
                <h2 id="research-spotlight-heading" className="research-spotlight__title">{spotlight.title}</h2>
                {(spotlight.abstract || spotlight.description) && (
                  <p className="research-spotlight__abstract">{spotlight.abstract || spotlight.description}</p>
                )}
                <div className="research-spotlight__meta">
                  <span>{formatDate(spotlight.start_date)}{spotlight.end_date ? ` — ${formatDate(spotlight.end_date)}` : " · Published"}</span>
                  {spotlight.industry && <span>{spotlight.industry}</span>}
                </div>
                {spotlight.technologies && spotlight.technologies.length > 0 && (
                  <div className="research-card__tech">
                    {spotlight.technologies.slice(0, 6).map((t) => <span key={t} className="research-card__tech-tag">{t}</span>)}
                  </div>
                )}
                <span className="research-spotlight__link">Read the full research brief →</span>
              </div>
            </Link>
          </section>
        )}

        {/* Research library */}
        {!loadError && items && visibleItems.length > 0 && (
          <section className="research-library" aria-labelledby="research-library-heading">
            <span id="research-library-heading" className="research-section-label">Research Library</span>
            <div className="research-grid">
              {visibleItems.map((item) => (
                <Link key={item.id} to={`/research/${item.slug}`} className="research-card">
                  <div className="research-card__badges">
                    {item.category && <span className="research-card__badge research-card__badge--category">{item.category}</span>}
                    {item.status && <span className="research-card__badge research-card__badge--status">{item.status.replace(/_/g, " ")}</span>}
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
                      {item.technologies.slice(0, 4).map((t) => <span key={t} className="research-card__tech-tag">{t}</span>)}
                      {item.technologies.length > 4 && <span className="research-card__tech-tag">+{item.technologies.length - 4}</span>}
                    </div>
                  )}
                  <div className="research-card__footer">
                    <span className="research-card__dates">
                      {formatDate(item.start_date)}{item.end_date ? ` — ${formatDate(item.end_date)}` : ""}
                    </span>
                    <span className="research-card__arrow">Read the brief →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Methodology */}
        {!loadError && items && (
          <section className="research-method" aria-labelledby="research-method-heading">
            <span className="research-section-label">Research Methodology</span>
            <h2 id="research-method-heading" className="research-method__heading">How our research runs</h2>
            <div className="research-method__steps">
              {METHOD_STEPS.map((s) => (
                <div key={s.num} className="research-method__step">
                  <div className="research-method__step-num">{s.num}</div>
                  <h3 className="research-method__step-title">{s.title}</h3>
                  <p className="research-method__step-desc">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Publications & researchers */}
        {!loadError && items && (publications.length > 0 || researchers.length > 0) && (
          <section className="research-refs" aria-labelledby="research-refs-heading">
            <h2 id="research-refs-heading" className="research-refs__title">Publications & Researchers</h2>
            <div className="research-refs__grid">
              {publications.length > 0 && (
                <div className="research-refs__block">
                  <h3>Publications</h3>
                  <ul className="research-refs__list">
                    {publications.map((link) => (
                      <li key={link}>
                        <a href={link} target="_blank" rel="noreferrer">{link}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {researchers.length > 0 && (
                <div className="research-refs__block">
                  <h3>Researchers</h3>
                  <ul className="research-refs__list">
                    {researchers.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA */}
        {!loadError && (
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
        )}
      </div>
    </div>
  )
}

export default Research
