import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchPublicProductBySlug, PublicProduct } from "../services/api"
import { Spinner, StateError, StatusBadge } from "../components/ui"
import { ChevronLeft } from "../components/icons"

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  usePageMeta({
    title: product?.name || "Product",
    description: product?.description || undefined,
    canonical: `/products/${slug}`,
  })

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setProduct(null)
    fetchPublicProductBySlug(slug || "")
      .then((data) => active && setProduct(data))
      .catch((e: any) => active && setError(e.message || "Product not found."))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <Spinner className="mx-auto" label="Loading product…" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <StateError message={error || "This product could not be found."} onRetry={() => window.location.reload()} />
        <div className="text-center mt-4">
          <Link to="/products" className="btn-secondary inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back to products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <main id="main" className="max-w-5xl mx-auto px-4 py-12">
      <Link to="/products" className="btn-link inline-flex items-center gap-1 mb-4">
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> All products
      </Link>

      <div className="card p-8 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            {product.category && (
              <span className="text-sm uppercase tracking-wide text-blue-600">{product.category}</span>
            )}
          </div>
          <StatusBadge status={product.status} />
        </div>
        <p className="text-gray-600 leading-relaxed">{product.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {product.overview && (
          <section className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Overview</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{product.overview}</p>
          </section>
        )}
        {product.problem && (
          <section className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Problem</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{product.problem}</p>
          </section>
        )}
        {product.solution && (
          <section className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Solution</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{product.solution}</p>
          </section>
        )}
      </div>

      {product.capabilities && product.capabilities.length > 0 && (
        <section className="mb-8" aria-labelledby="caps-heading">
          <h2 id="caps-heading" className="text-xl font-bold text-gray-900 mb-4">Capabilities</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {product.capabilities.map((cap) => (
              <li key={cap} className="flex items-start gap-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-4 py-3">
                <span className="text-blue-600 mt-0.5" aria-hidden="true">✓</span>
                {cap}
              </li>
            ))}
          </ul>
        </section>
      )}

      {product.technologies && product.technologies.length > 0 && (
        <section className="mb-8" aria-labelledby="tech-heading">
          <h2 id="tech-heading" className="text-xl font-bold text-gray-900 mb-4">Technologies</h2>
          <div className="flex flex-wrap gap-2">
            {product.technologies.map((tech) => (
              <span key={tech} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm">{tech}</span>
            ))}
          </div>
        </section>
      )}

      {product.screenshots && product.screenshots.length > 0 && (
        <section className="mb-8" aria-labelledby="shots-heading">
          <h2 id="shots-heading" className="text-xl font-bold text-gray-900 mb-4">Screenshots</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {product.screenshots.map((src, i) => (
              <img key={i} src={src} alt={`${product.name} screenshot ${i + 1}`} className="rounded-lg border border-gray-200 object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      <div className="card bg-slate-900 text-white p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Interested in {product.name}?</h2>
        <p className="text-gray-300 mb-6 max-w-lg mx-auto">
          Request a demo or a quote to see how this product can work for you.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/quote" className="btn-primary">Request a demo</Link>
          <Link to="/quote" className="bg-transparent border border-gray-400 text-white hover:bg-white/10 px-6 py-3 rounded-md font-medium">
            Get a quote
          </Link>
        </div>
      </div>
    </main>
  )
}

export default ProductDetail
