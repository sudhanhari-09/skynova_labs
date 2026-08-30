import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchExperiments, Experiment } from "../services/api"

const fallbackCards = [
  { title: "Prototype Validation", objective: "We build small prototypes to test feasibility, performance and user experience before committing to a full implementation." },
  { title: "Tooling Evaluations", objective: "New frameworks, cloud services and libraries are evaluated against realistic workloads to give clients evidence-based recommendations." },
]

const Experiments: React.FC = () => {
  const [items, setItems] = useState<Experiment[] | null>(null)

  const load = useCallback(() => {
    fetchExperiments()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])
  useEffect(() => { load() }, [load])

  const isEmpty = items !== null && items.length === 0

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Experiments</h1>
        <p className="text-gray-600 mb-8 max-w-3xl">
          Hands-on experiments and proof-of-concepts run by our team to validate new
          technologies and approaches before they reach production.
        </p>

        {items === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {fallbackCards.map((c) => (
              <div key={c.title} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-medium text-gray-900 mb-2">{c.title}</h3>
                <p className="text-gray-600">{c.objective}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/experiments/${item.slug}`}
                className="bg-white rounded-lg shadow hover:shadow-md hover:border-blue-200 transition-shadow p-6"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {item.status && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{item.status}</span>}
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 line-clamp-3">{item.objective || item.description}</p>
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
      </div>
    </main>
  )
}

export default Experiments