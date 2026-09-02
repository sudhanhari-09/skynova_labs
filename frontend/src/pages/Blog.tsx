import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPublicBlog, CmsBlogPost } from "../services/api"

const CATEGORIES = [
  "All",
  "Engineering",
  "AI & Machine Learning",
  "Research",
  "Hardware",
  "Experiments",
  "Methodology",
  "Product Development",
  "Software Architecture",
  "Technology Trends",
]

function readingTime(content: string | null | undefined): number {
  if (!content) return 1
  const words = content.split(/\s+/).length
  return Math.max(1, Math.round(words / 220))
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}

function excerptPreview(content: string | null | undefined, maxLen = 160): string {
  if (!content) return ""
  const text = content.replace(/#{1,6}\s/g, "").replace(/\*+/g, "").replace(/\n+/g, " ").trim()
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "..." : text
}

const BlogCard: React.FC<{ post: CmsBlogPost; featured?: boolean }> = ({ post, featured }) => (
  <Link
    to={`/blog/${post.slug}`}
    className={`blog-card ${featured ? "blog-card--featured" : ""}`}
  >
    <div className={`blog-card__image ${featured ? "blog-card__image--featured" : ""}`}>
      {post.cover_image ? (
        <img src={post.cover_image} alt="" loading="lazy" />
      ) : (
        <div className="blog-card__image-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}
      <div className="blog-card__overlay" />
    </div>
    <div className={`blog-card__body ${featured ? "blog-card__body--featured" : ""}`}>
      <div className="blog-card__meta-row">
        {post.category && (
          <span className="blog-card__category">{post.category}</span>
        )}
        {post.is_featured && (
          <span className="blog-card__badge">Featured</span>
        )}
      </div>
      <h3 className={`blog-card__title ${featured ? "blog-card__title--featured" : ""}`}>
        {post.title}
      </h3>
      {post.excerpt && (
        <p className={`blog-card__excerpt ${featured ? "blog-card__excerpt--featured" : ""}`}>
          {featured ? post.excerpt : (post.excerpt.length > 140 ? post.excerpt.slice(0, 140) + "..." : post.excerpt)}
        </p>
      )}
      <div className="blog-card__footer">
        <span className="blog-card__author">SkyNova Project Labs</span>
        <span className="blog-card__separator">·</span>
        <span className="blog-card__date">{formatDate(post.published_at)}</span>
        <span className="blog-card__separator">·</span>
        <span className="blog-card__read-time">{readingTime(post.content)} min read</span>
      </div>
      <span className="blog-card__link">Read Article →</span>
    </div>
  </Link>
)

const Blog: React.FC = () => {
  const [posts, setPosts] = useState<CmsBlogPost[] | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  const load = useCallback(() => {
    fetchPublicBlog()
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [])
  useEffect(() => { load() }, [load])

  const availableCategories = useMemo(() => {
    if (!posts) return CATEGORIES
    const used = new Set(posts.map((p) => p.category).filter(Boolean) as string[])
    return ["All", ...CATEGORIES.filter((c) => used.has(c))]
  }, [posts])

  const filteredPosts = useMemo(() => {
    if (!posts) return []
    let result = posts

    if (activeCategory !== "All") {
      result = result.filter((p) => p.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      )
    }

    return result
  }, [posts, activeCategory, searchQuery])

  const featuredPost = useMemo(() => {
    if (!filteredPosts.length) return null
    return filteredPosts.find((p) => p.is_featured) || filteredPosts[0]
  }, [filteredPosts])

  const gridPosts = useMemo(() => {
    if (!featuredPost) return filteredPosts
    return filteredPosts.filter((p) => p.id !== featuredPost.id)
  }, [filteredPosts, featuredPost])

  return (
    <main id="main">
      {/* Hero Section */}
      <section className="blog-hero">
        <div className="blog-hero__inner">
          <span className="blog-hero__eyebrow">Blog / Journal</span>
          <h1 className="blog-hero__title">
            Ideas, Experiments &amp; Engineering Lessons
          </h1>
          <p className="blog-hero__subtitle">
            Insights from the SkyNova Project Labs team on engineering, applied research,
            product development and the technology decisions behind what we build.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="blog-content">
        <div className="blog-content__inner">

          {/* Filters & Search */}
          <div className="blog-toolbar">
            <div className="blog-toolbar__filters">
              {availableCategories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`blog-filter-btn ${activeCategory === c ? "blog-filter-btn--active" : ""}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="blog-toolbar__search">
              <svg className="blog-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="blog-search-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="blog-search-clear">
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {posts === null && (
            <div className="blog-loading">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="blog-skeleton-card">
                  <div className="blog-skeleton-image animate-pulse" />
                  <div className="blog-skeleton-body">
                    <div className="blog-skeleton-line blog-skeleton-line--short animate-pulse" />
                    <div className="blog-skeleton-line blog-skeleton-line--long animate-pulse" />
                    <div className="blog-skeleton-line blog-skeleton-line--medium animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {posts && filteredPosts.length === 0 && (
            <div className="blog-empty">
              <div className="blog-empty__icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h2 className="blog-empty__title">
                {searchQuery ? "No articles found" : "No articles published yet"}
              </h2>
              <p className="blog-empty__text">
                {searchQuery
                  ? `No articles match "${searchQuery}". Try a different search term or browse all categories.`
                  : "We're working on our first set of engineering and research articles. Please check back soon."}
              </p>
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setActiveCategory("All") }} className="btn-primary mt-4">
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Featured Article */}
          {featuredPost && !searchQuery && activeCategory === "All" && (
            <div className="blog-featured-section">
              <span className="blog-section-label">Featured Article</span>
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Article Grid */}
          {gridPosts.length > 0 && (
            <>
              {featuredPost && !searchQuery && activeCategory === "All" && (
                <span className="blog-section-label">Latest Articles</span>
              )}
              <div className="blog-grid">
                {gridPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="blog-cta">
        <div className="blog-cta__inner">
          <h2 className="blog-cta__title">Explore Project Labs</h2>
          <p className="blog-cta__text">
            Discover our engineering projects, research initiatives, and experiments.
          </p>
          <div className="blog-cta__links">
            <Link to="/projects" className="btn-primary">Projects</Link>
            <Link to="/research" className="btn-secondary">Research</Link>
            <Link to="/experiments" className="btn-secondary">Experiments</Link>
            <Link to="/products" className="btn-secondary">Products</Link>
            <Link to="/quote" className="btn-secondary">Get a Quote</Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Blog
