import React, { useEffect, useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { Spinner, EmptyState } from "../components/ui"
import { fetchJournalArticles, JournalArticle } from "../services/api"

const Journal: React.FC = () => {
  usePageMeta({
    title: "Journal",
    description:
      "Research and editorial thinking from SkyNova Project Labs — on engineering, applied research, product development and technology trends.",
    canonical: "/journal",
  })

  const [articles, setArticles] = useState<JournalArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchJournalArticles()
      .then((data) => active && setArticles(data))
      .catch((e: any) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [articles])

  return (
    <main id="main" className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Hero */}
      <section className="blog-hero">
        <div className="blog-hero__inner">
          <span className="blog-hero__eyebrow">Journal</span>
          <h1 className="blog-hero__title">
            Research &amp; Editorial Perspectives
          </h1>
          <p className="blog-hero__subtitle">
            Long-form thinking from the SkyNova Project Labs team — on engineering,
            applied research, product development and the technology decisions behind our work.
          </p>
        </div>
      </section>

      <section style={{ padding: "2rem 1.5rem 4rem", maxWidth: 720, margin: "0 auto" }}>
        {/* Category pills */}
        {categories.length > 0 && (
          <div className="blog-toolbar__filters" style={{ marginBottom: "1.5rem" }}>
            {categories.map((cat) => (
              <span key={cat} className="blog-filter-btn" style={{ cursor: "default" }}>
                {cat}
              </span>
            ))}
          </div>
        )}

        {loading && (
          <div className="py-16">
            <Spinner className="mx-auto" label="Loading journal..." />
          </div>
        )}

        {!loading && error && (
          <div className="blog-empty">
            <h2 className="blog-empty__title">Journal unavailable</h2>
            <p className="blog-empty__text">
              The journal API is not available right now. Please check back soon.
            </p>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <EmptyState
            icon="&#9998;"
            title="No journal articles published yet"
            description="We're working on our first research and editorial pieces. Please check back soon."
            action={{ label: "Explore our work", to: "/projects" }}
          />
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="blog-grid">
            {articles.map((article) => (
              <Link key={article.id} to={`/journal/${article.slug}`} className="blog-card">
                <div className="blog-card__body">
                  <div className="blog-card__meta-row">
                    {article.category && (
                      <span className="blog-card__category">{article.category}</span>
                    )}
                  </div>
                  <h2 className="blog-card__title">{article.title}</h2>
                  {article.excerpt && (
                    <p className="blog-card__excerpt">{article.excerpt}</p>
                  )}
                  <div className="blog-card__footer">
                    {article.author && <span className="blog-card__author">{article.author}</span>}
                    {article.published_at && (
                      <>
                        <span className="blog-card__separator">&middot;</span>
                        <span className="blog-card__date">
                          {new Date(article.published_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                    {article.reading_minutes && (
                      <>
                        <span className="blog-card__separator">&middot;</span>
                        <span className="blog-card__read-time">{article.reading_minutes} min read</span>
                      </>
                    )}
                  </div>
                  <span className="blog-card__link">Read Article &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default Journal
