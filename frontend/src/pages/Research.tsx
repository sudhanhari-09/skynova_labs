import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchResearch } from "../services/api"
import type { Research } from "../services/api"

const fallbackTopics = [
  { title: "Applied Machine Learning", abstract: "We evaluate modern ML models and tooling for practical problems such as document processing, prediction and automation.", category: null, status: null },
  { title: "Software Architecture", abstract: "We research scalable architectures, API design and delivery practices that keep complex products maintainable.", category: null, status: null },
  { title: "Experimental Prototyping", abstract: "We build small, testable prototypes to de-risk new features before committing to a full product build.", category: null, status: null },
]

const Research: React.FC = () => {
  const [items, setItems] = useState<Research[] | null>(null)

  const load = useCallback(() => {
    fetchResearch()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

  const isEmpty = items !== null && items.length === 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Research</h1>
        <p className="text-gray-600 mb-8 max-w-3xl">
          We invest in applied research across software engineering, applied AI and
          emerging technologies. Findings from our research inform the products and
          solutions we build for clients.
        </p>

        {items === null ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="space-y-4">
            {fallbackTopics.map((t) => (
              <div key={t.title} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-medium text-gray-900">{t.title}</h3>
                <p className="text-gray-600 mt-1">{t.abstract}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/research/${item.slug}`}
                className="block bg-white rounded-lg shadow hover:shadow-md hover:border-blue-200 transition-shadow p-6"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {item.category && <span className="text-xs uppercase tracking-wide text-blue-600 font-medium">{item.category}</span>}
                  {item.status && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{item.status}</span>}
                </div>
                <h3 className="text-xl font-medium text-gray-900">{item.title}</h3>
                <p className="text-gray-600 mt-1 line-clamp-2">{item.abstract || item.description}</p>
                {item.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {item.technologies.slice(0, 4).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{t}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link to="/quote" className="btn-primary">
            Bring a research question to us
          </Link>
        </div>
      </div>
    </main>
  )
}

export default Research