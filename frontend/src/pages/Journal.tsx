import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { Spinner, StateError, EmptyState } from "../components/ui"
import { fetchJournalArticles, JournalArticle } from "../services/api"

/**
 * Journal = long-form editorial and research thinking (thought leadership).
 * Distinct from the Build Log (actual project progress) and Blog.
 * Data is CMS/API-driven; a backend journal API is a documented dependency.
 */

const sampleCategories = ["Research", "Engineering", "Product", "Industry", "Perspectives"]

const Journal: React.FC = () => {
  usePageMeta({
    title: "Journal",
    description:
      "Research and editorial thinking from Skynova Project Labs — on engineering, applied research, product development and technology trends.",
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

  return (
    <main id="main" className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Journal</h1>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Research and editorial perspectives from our team — the thinking behind the work.
      </p>

      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Journal categories">
        {sampleCategories.map((cat) => (
          <span key={cat} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm">
            {cat}
          </span>
        ))}
      </div>

      {loading && (
        <div className="py-16">
          <Spinner className="mx-auto" label="Loading journal…" />
        </div>
      )}

      {!loading && error && (
        <StateError
          message="The journal API is not available yet, so articles cannot be loaded right now."
        />
      )}

      {!loading && !error && articles.length === 0 && (
        <EmptyState
          icon="✍️"
          title="No journal articles published yet"
          description="We're working on our first research and editorial pieces. Please check back soon."
          action={{ label: "Explore our work", to: "/projects" }}
        />
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link key={article.id} to={`/journal/${article.slug}`} className="card flex flex-col group hover:border-blue-200 transition-colors">
              <span className="text-xs uppercase tracking-wide text-blue-600 mb-2">{article.category}</span>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600">{article.title}</h2>
              {article.excerpt && <p className="text-sm text-gray-600 flex-1">{article.excerpt}</p>}
              <div className="flex items-center gap-3 mt-4 text-xs text-gray-500">
                {article.author && <span>{article.author}</span>}
                {article.published_at && <span>{new Date(article.published_at).toLocaleDateString()}</span>}
                {article.reading_minutes && <span>{article.reading_minutes} min read</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

export default Journal
