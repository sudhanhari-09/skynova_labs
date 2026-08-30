import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { Spinner, StateError, EmptyState } from "../components/ui"
import { fetchBuildLogEntries, BuildLogEntry } from "../services/api"

/**
 * Build Log = actual company/project progress: development, experiments,
 * implementation lessons and technical updates. Distinct from Journal
 * (editorial) and Blog. Data is API/CMS-driven (documented backend dependency).
 */

const BuildLog: React.FC = () => {
  usePageMeta({
    title: "Build Log",
    description:
      "Development progress, experiments and technical updates from inside Skynova Project Labs.",
    canonical: "/build-log",
  })

  const [entries, setEntries] = useState<BuildLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchBuildLogEntries()
      .then((data) => active && setEntries(data))
      .catch((e: any) => active && setError(e.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <main id="main" className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Build Log</h1>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Real development progress from inside the lab — what we're building, breaking and learning.
      </p>

      {loading && (
        <div className="py-16">
          <Spinner className="mx-auto" label="Loading build log…" />
        </div>
      )}

      {!loading && error && (
        <StateError message="The build log API is not available yet, so updates cannot be loaded right now." />
      )}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon="🔨"
          title="No build entries yet"
          description="Development and experiment updates will appear here as we ship."
          action={{ label: "See our projects", to: "/projects" }}
        />
      )}

      {!loading && !error && entries.length > 0 && (
        <ol className="relative border-l-2 border-blue-200 ml-3 space-y-8">
          {entries.map((entry) => (
            <li key={entry.id} className="ml-6 relative">
              <span className="absolute -left-[31px] mt-1.5 w-4 h-4 rounded-full border-2 border-blue-600 bg-white" aria-hidden="true" />
              <article className="card p-6">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">{entry.title}</h2>
                  {entry.project_id && (
                    <span className="text-xs uppercase tracking-wide text-blue-600">
                      {entry.entry_type === "COMPLETED" ? "Ship complete" : "In progress"} · Project #{entry.project_id}
                    </span>
                  )}
                </div>
                {entry.description && <p className="text-sm text-gray-600 mb-3">{entry.description}</p>}
                {entry.technologies && entry.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {entry.technologies.map((tech) => (
                      <span key={tech} className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{tech}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {entry.entry_type && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{entry.entry_type}</span>}
                  {entry.entry_date && <span>{new Date(entry.entry_date).toLocaleDateString()}</span>}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}

export default BuildLog
