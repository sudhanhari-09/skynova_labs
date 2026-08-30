import React, { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPublicProjects, PublicProject } from "../services/api"

const processCards = [
  { title: "Discovery", body: "We capture requirements, review your existing system and define the scope of what success looks like." },
  { title: "Estimation & Proposal", body: "After technical analysis, you receive a clear quotation with timeline, budget and deliverables." },
  { title: "Delivery", body: "Milestones, tasks and progress updates keep you informed throughout the build." },
]

const Projects: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PublicProject[] | null>(null)

  const load = useCallback(() => {
    fetchPublicProjects({ limit: 12 })
      .then((res) => setPortfolio(res.projects))
      .catch(() => setPortfolio([]))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Projects</h1>
        <p className="text-gray-600 mb-8 max-w-3xl">
          We deliver research and development projects across web, mobile and AI/ML
          solutions. Every engagement is scoped, estimated and delivered through a
          transparent milestone and task plan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {processCards.map((card) => (
            <div key={card.title} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-medium text-gray-900 mb-2">{card.title}</h3>
              <p className="text-gray-600">{card.body}</p>
            </div>
          ))}
        </div>

        {portfolio !== null && portfolio.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current portfolio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolio.map((p) => (
                <Link
                  key={p.project_number}
                  to={`/project/${p.project_number}`}
                  className="bg-white rounded-lg shadow hover:shadow-md hover:border-blue-200 transition-shadow p-6"
                >
                  <div className="text-xs font-mono text-gray-400 mb-1">{p.project_number}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{p.title}</h3>
                  {p.description && <p className="text-gray-600 text-sm line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between mt-4 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{p.status}</span>
                    <span className="text-gray-500">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString() : ""}
                      {p.target_end_date ? ` → ${new Date(p.target_end_date).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-6">
            Want to see what we could build for you? Tell us about your idea.
          </p>
          <Link to="/quote" className="btn-primary">
            Get a Quote
          </Link>
        </div>
      </div>
    </main>
  )
}

export default Projects