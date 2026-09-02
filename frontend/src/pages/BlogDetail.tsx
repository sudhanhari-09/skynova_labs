import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fetchPublicBlogPost, fetchPublicBlog, CmsBlogPost } from "../services/api"

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

function renderMarkdown(body: string | null | undefined): string {
  if (!body) return ""
  return body
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`)
    .replace(/^\n\n/gm, '</p><p>')
    .replace(/^(?!<[hulo])/gm, '')
}

const BlogDetail: React.FC = () => {
  const { slug = "" } = useParams()
  const [post, setPost] = useState<CmsBlogPost | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<CmsBlogPost[]>([])

  useEffect(() => {
    fetchPublicBlogPost(slug)
      .then((p) => {
        setPost(p)
        fetchPublicBlog()
          .then((all) => {
            const related = all
              .filter((a) => a.slug !== slug && a.category === p.category)
              .slice(0, 3)
            setRelatedPosts(related.length > 0 ? related : all.filter((a) => a.slug !== slug).slice(0, 3))
          })
          .catch(() => {})
      })
      .catch((e) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <main className="min-h-screen" style={{ background: "var(--background)" }}>
        <div className="blog-detail-error">
          <h1 className="blog-detail-error__title">Article Not Found</h1>
          <p className="blog-detail-error__text">{error}</p>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="min-h-screen" style={{ background: "var(--background)" }}>
        <div className="blog-detail-skeleton">
          <div className="blog-skeleton-line blog-skeleton-line--short animate-pulse" style={{ maxWidth: 120, height: 14, margin: "2rem auto 1rem" }} />
          <div className="blog-skeleton-line animate-pulse" style={{ maxWidth: 600, height: 32, margin: "0 auto 0.75rem" }} />
          <div className="blog-skeleton-line blog-skeleton-line--medium animate-pulse" style={{ maxWidth: 400, height: 16, margin: "0 auto 2rem" }} />
          <div className="blog-skeleton-image animate-pulse" style={{ maxWidth: 900, height: 360, margin: "0 auto 2rem" }} />
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="blog-skeleton-line animate-pulse" style={{ marginBottom: "1rem" }} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  const articleBody = renderMarkdown(post.content)

  return (
    <main id="main" className="blog-detail-page">
      {/* Breadcrumb */}
      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <div className="blog-breadcrumb__inner">
          <Link to="/" className="blog-breadcrumb__link">Home</Link>
          <span className="blog-breadcrumb__sep">/</span>
          <Link to="/blog" className="blog-breadcrumb__link">Blog</Link>
          <span className="blog-breadcrumb__sep">/</span>
          <span className="blog-breadcrumb__current">{post.title}</span>
        </div>
      </nav>

      {/* Article Header */}
      <header className="blog-detail-header">
        <div className="blog-detail-header__inner">
          {post.category && (
            <Link to="/blog" className="blog-detail-header__category">{post.category}</Link>
          )}
          <h1 className="blog-detail-header__title">{post.title}</h1>
          {post.excerpt && (
            <p className="blog-detail-header__excerpt">{post.excerpt}</p>
          )}
          <div className="blog-detail-header__meta">
            <div className="blog-detail-header__author">
              <div className="blog-detail-header__avatar">SN</div>
              <div>
                <span className="blog-detail-header__author-name">SkyNova Project Labs</span>
                <span className="blog-detail-header__date">{formatDate(post.published_at)}</span>
              </div>
            </div>
            <span className="blog-detail-header__readtime">{readingTime(post.content)} min read</span>
          </div>
        </div>
      </header>

      {/* Hero Image */}
      {post.cover_image && (
        <div className="blog-detail-hero">
          <div className="blog-detail-hero__inner">
            <img src={post.cover_image} alt="" className="blog-detail-hero__img" />
          </div>
        </div>
      )}

      {/* Article Body */}
      <article className="blog-detail-body">
        <div className="blog-detail-body__inner">
          <div className="blog-detail-prose" dangerouslySetInnerHTML={{ __html: articleBody }} />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="blog-detail-tags">
              {post.tags.map((t) => (
                <span key={t} className="blog-detail-tag">#{t}</span>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* Navigation */}
      <div className="blog-detail-nav">
        <div className="blog-detail-nav__inner">
          <Link to="/blog" className="blog-detail-nav__back">
            ← Back to All Articles
          </Link>
        </div>
      </div>

      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="blog-related">
          <div className="blog-related__inner">
            <h2 className="blog-related__title">Related Articles</h2>
            <div className="blog-related__grid">
              {relatedPosts.map((rp) => (
                <Link key={rp.id} to={`/blog/${rp.slug}`} className="blog-related__card">
                  {rp.cover_image && (
                    <div className="blog-related__card-image">
                      <img src={rp.cover_image} alt="" loading="lazy" />
                    </div>
                  )}
                  <div className="blog-related__card-body">
                    {rp.category && <span className="blog-related__card-category">{rp.category}</span>}
                    <h3 className="blog-related__card-title">{rp.title}</h3>
                    <div className="blog-related__card-meta">
                      {formatDate(rp.published_at)} · {readingTime(rp.content)} min read
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="blog-detail-cta">
        <div className="blog-detail-cta__inner">
          <h2 className="blog-detail-cta__title">Explore SkyNova Project Labs</h2>
          <p className="blog-detail-cta__text">
            Discover our engineering projects, research initiatives, and product development work.
          </p>
          <div className="blog-detail-cta__links">
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

export default BlogDetail
