import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fetchExperimentBySlug, Experiment } from "../services/api"

const ExperimentsDetail: React.FC = () => {
  const { slug = "" } = useParams()
  const [item, setItem] = useState<Experiment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchExperimentBySlug(slug)
      .then(setItem)
      .catch((e) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Experiment not found</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/experiments" className="btn-primary">Back to Experiments</Link>
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
    { label: "Objective", value: item.objective },
    { label: "Hypothesis", value: item.hypothesis },
    { label: "Procedure", value: item.procedure },
    { label: "Observations", value: item.observations },
    { label: "Results", value: item.results },
    { label: "Conclusion", value: item.conclusion },
    { label: "Next steps", value: item.next_step },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <article className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/experiments" className="text-sm text-blue-600 hover:underline">← Back to Experiments</Link>
        <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
          {item.status && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{item.status}</span>}
          {item.project_id && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Project #{item.project_id}</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{item.title}</h1>
        {item.description && (
          <p className="text-lg text-gray-600 leading-relaxed mb-6">{item.description}</p>
        )}
        {fields.filter((f) => f.value).map((f) => (
          <section key={f.label} className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{f.label}</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{f.value}</p>
          </section>
        ))}
        {item.components.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Components</h2>
            <div className="flex flex-wrap gap-2">
              {item.components.map((c) => (
                <span key={c} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{c}</span>
              ))}
            </div>
          </div>
        )}
        {item.technologies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6">
            {item.technologies.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium">{t}</span>
            ))}
          </div>
        )}
      </article>
    </main>
  )
}

export default ExperimentsDetail