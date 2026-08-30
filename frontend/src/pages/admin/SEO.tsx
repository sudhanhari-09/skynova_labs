import React, { useEffect, useState, useCallback } from "react"
import { fetchRobots, fetchSEOSnapshot, fetchSitemap, SEOSnapshot } from "../../services/api"
import { PageHeader, Skeleton, StateError, Badge } from "../../components/ui"
import { Globe, Eye, ArrowRight } from "../../components/icons"

const SEO: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SEOSnapshot | null>(null)
  const [sitemap, setSitemap] = useState("")
  const [robots, setRobots] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showSitemapXml, setShowSitemapXml] = useState(false)
  const [showRobotsPreview, setShowRobotsPreview] = useState(false)
  const [copiedSitemap, setCopiedSitemap] = useState(false)
  const [copiedRobots, setCopiedRobots] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [s, sm, rb] = await Promise.all([
          fetchSEOSnapshot().catch(() => null),
          fetchSitemap().catch(() => ""),
          fetchRobots().catch(() => ""),
        ])
        if (!active) return
        setSnapshot(s)
        setSitemap(sm)
        setRobots(rb)
      } catch (e: any) {
        if (!active) return
        setError(e.message || "Failed to load SEO data")
      }
    }
    load()
    return () => { active = false }
  }, [])

  const labels: Record<string, string> = {
    projects: "Projects",
    services: "Services",
    blog_posts: "Blog Posts",
    research: "Research",
    experiments: "Experiments",
    pages: "CMS Pages",
    case_studies: "Case Studies",
  }

  const icons: Record<string, string> = {
    projects: "📁",
    services: "🔧",
    blog_posts: "📝",
    research: "🔬",
    experiments: "🧪",
    pages: "📄",
    case_studies: "💼",
  }

  const copyToClipboard = useCallback(async (text: string, type: "sitemap" | "robots") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "sitemap") {
        setCopiedSitemap(true)
        setTimeout(() => setCopiedSitemap(false), 2000)
      } else {
        setCopiedRobots(true)
        setTimeout(() => setCopiedRobots(false), 2000)
      }
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      if (type === "sitemap") {
        setCopiedSitemap(true)
        setTimeout(() => setCopiedSitemap(false), 2000)
      } else {
        setCopiedRobots(true)
        setTimeout(() => setCopiedRobots(false), 2000)
      }
    }
  }, [])

  const sitemapUrlCount = sitemap ? (sitemap.match(/<url>/g) || []).length : 0

  return (
    <main className="min-h-screen" style={{ background: "var(--background)" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="SEO"
          subtitle="Monitor your site's search engine optimization status, sitemap, and robots.txt configuration."
        />

        {error && <StateError message={error} />}

        {!snapshot ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <section className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-secondary)" }}>
                Content Overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(snapshot.counts).map(([key, value]) => (
                  <div key={key} className="stat-card">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base" aria-hidden="true">{icons[key] || "📊"}</span>
                      <div className="stat-card__label">{labels[key] || key}</div>
                    </div>
                    <div className="stat-card__value">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Base URL & Total Indexable */}
            <section className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "var(--brand-primary-light)" }}>
                      <Globe className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        Base URL
                      </div>
                      <div className="text-sm font-semibold mt-0.5 break-all" style={{ color: "var(--text-primary)" }}>
                        {snapshot.base_url}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "var(--accent-gold-light)" }}>
                      <span className="text-lg" aria-hidden="true">📊</span>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        Total Indexable URLs
                      </div>
                      <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {snapshot.total_indexable} content items
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sitemap & Robots.txt Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sitemap Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "#ECFDF3" }}>
                      <span className="text-lg" aria-hidden="true">🗺️</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>sitemap.xml</h3>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {sitemap ? `${sitemapUrlCount} URLs indexed` : "Not available"}
                      </p>
                    </div>
                  </div>
                  <Badge className={sitemap ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {sitemap ? "Live" : "Unavailable"}
                  </Badge>
                </div>

                {sitemap && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => window.open(`${snapshot.base_url}/seo/sitemap.xml`, "_blank")}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Open Sitemap
                      </span>
                    </button>
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => copyToClipboard(sitemap, "sitemap")}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {copiedSitemap ? "✓ Copied" : "Copy XML"}
                      </span>
                    </button>
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => setShowSitemapXml(!showSitemapXml)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {showSitemapXml ? "Hide XML" : "View XML"}
                      </span>
                    </button>
                  </div>
                )}

                {showSitemapXml && sitemap && (
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <pre
                      className="p-4 text-xs overflow-auto max-h-64 whitespace-pre-wrap"
                      style={{
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      }}
                    >
                      {sitemap}
                    </pre>
                  </div>
                )}

                {!sitemap && (
                  <div className="text-center py-6" style={{ color: "var(--text-secondary)" }}>
                    <p className="text-sm">Sitemap is currently unavailable.</p>
                    <p className="text-xs mt-1">Check that the backend service is running.</p>
                  </div>
                )}
              </div>

              {/* Robots.txt Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "var(--brand-primary-light)" }}>
                      <span className="text-lg" aria-hidden="true">🤖</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>robots.txt</h3>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Crawler directives
                      </p>
                    </div>
                  </div>
                  <Badge className={robots ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {robots ? "Live" : "Unavailable"}
                  </Badge>
                </div>

                {robots && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => window.open(`${snapshot.base_url}/seo/robots.txt`, "_blank")}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Open Robots.txt
                      </span>
                    </button>
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => copyToClipboard(robots, "robots")}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {copiedRobots ? "✓ Copied" : "Copy Content"}
                      </span>
                    </button>
                    <button
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => setShowRobotsPreview(!showRobotsPreview)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {showRobotsPreview ? "Hide" : "View"}
                      </span>
                    </button>
                  </div>
                )}

                {showRobotsPreview && robots && (
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <pre
                      className="p-4 text-xs overflow-auto max-h-64 whitespace-pre-wrap"
                      style={{
                        background: "var(--surface-secondary)",
                        color: "var(--text-secondary)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      }}
                    >
                      {robots}
                    </pre>
                  </div>
                )}

                {!robots && (
                  <div className="text-center py-6" style={{ color: "var(--text-secondary)" }}>
                    <p className="text-sm">Robots.txt is currently unavailable.</p>
                    <p className="text-xs mt-1">Check that the backend service is running.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default SEO
