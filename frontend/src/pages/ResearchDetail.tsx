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
      .catch((e) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Research not found</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/research" className="btn-primary">Back to Research</Link>
        </div>
      </main>
    )
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />)}
          </div>
        </div>
      </main>
    )
  }

  const fields: { label: string; value?: string | null }[] = [
    { label: "Objectives", value: item.objectives },
    { label: "Methodology", value: item.methodology },
    { label: "Results", value: item.results },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <article className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/research" className="text-sm text-blue-600 hover:underline">← Back to Research</Link>
        <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
          {item.category && <span className="text-xs uppercase tracking-wide text-blue-600 font-medium">{item.category}</span>}
          {item.industry && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.industry}</span>}
          {item.status && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{item.status}</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{item.title}</h1>
        {(item.start_date || item.end_date) && (
          <div className="text-sm text-gray-500 mb-6">
            {[item.start_date, item.end_date].filter(Boolean).join(" → ")}
          </div>
        )}
        {item.abstract && <p className="text-lg text-gray-600 leading-relaxed mb-6">{item.abstract}</p>}
        {item.description && (
          <div className="prose prose-slate max-w-none text-gray-700 leading-relaxed whitespace-pre-line mb-6">{item.description}</div>
        )}
        {fields.filter((f) => f.value).map((f) => (
          <section key={f.label} className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{f.label}</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{f.value}</p>
          </section>
        ))}
        {item.technologies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {item.technologies.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{t}</span>
            ))}
          </div>
        )}
        {(item.researchers && item.researchers.length > 0) && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Researchers</h2>
            <div className="text-gray-600 text-sm">{item.researchers.join(", ")}</div>
          </div>
        )}
        {(item.publication_links && item.publication_links.length > 0) && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Publications</h2>
            <ul className="list-disc list-inside text-gray-600 text-sm space-y-1">
              {item.publication_links.map((link, i) => (
                <li key={i}><a href={link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{link}</a></li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </main>
  )
}

export default ResearchDetail