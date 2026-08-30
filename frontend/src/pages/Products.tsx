import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchPublicProducts, PublicProduct } from "../services/api"
import { Spinner, StateError, EmptyState } from "../components/ui"
import { ArrowRight, LayoutGrid } from "../components/icons"

const Products: React.FC = () => {
  usePageMeta({
    title: "Products",
    description:
      "Ready-to-use products developed by Skynova Project Labs — born from our research and experimentation pipeline.",
    canonical: "/products",
  })

  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchPublicProducts()
      .then((data) => setProducts(data))
      .catch((e: any) => setError(e.message || "Could not load products."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main id="main" className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
      <p className="text-gray-600 mb-10 max-w-3xl">
        The reusable products Project Labs has turned into reliable, maintained
        tools — the outcomes of our research and experimentation pipeline.
      </p>

      {loading && (
        <div className="py-16">
          <Spinner className="mx-auto" label="Loading products…" />
        </div>
      )}

      {!loading && error && (
        <StateError
          message={`${error} The public product catalogue is not available yet.`}
          onRetry={load}
        />
      )}

      {!loading && !error && products.length === 0 && (
        <EmptyState
          icon="📦"
          title="No products published yet"
          description="Our products are still in active development. Check back soon, or get in touch to learn about what's on the way."
          action={{ label: "Explore our solutions", to: "/solutions" }}
        />
      )}

      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Link key={product.id} to={`/products/${product.slug}`} className="card flex flex-col group hover:border-blue-200 transition-colors">
              {product.hero_image && (
                <img
                  src={product.hero_image}
                  alt=""
                  className="w-full h-40 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
                  loading="lazy"
                />
              )}
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid className="w-5 h-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">{product.name}</h2>
              </div>
              {product.category && (
                <span className="text-xs uppercase tracking-wide text-blue-600 mb-2">{product.category}</span>
              )}
              <p className="text-gray-600 text-sm flex-1">{product.description}</p>
              <span className="btn-link mt-4 inline-flex items-center gap-1">
                View product <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

export default Products
