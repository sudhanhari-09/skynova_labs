import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { fetchPublicBlog, CmsBlogPost } from "../services/api"

const fallbackPosts: CmsBlogPost[] = [
  {
    id: 0, title: "Engineering Under The Hood", slug: "", category: "Engineering",
    excerpt: "Insights from the SkyNova Project Labs team on engineering, delivery and technology trends.",
    is_published: true, is_featured: false, tags: [], content: "",
  },
]

const Blog: React.FC = () => {
  const [posts, setPosts] = useState<CmsBlogPost[] | null>(null)
  const [category, setCategory] = useState<string>("All")

  const load = useCallback(() => {
    fetchPublicBlog()
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [])
  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const set = new Set((posts ?? []).map((p) => p.category).filter(Boolean) as string[])
    return ["All", ...Array.from(set).sort()]
  }, [posts])

  const visible = useMemo(() => {
    if (!posts) return []
    if (category === "All") return posts
    return posts.filter((p) => p.category === category)
  }, [posts, category])

  const list = posts && posts.length === 0 ? fallbackPosts : visible

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog</h1>
        <p className="text-gray-600 mb-8 max-w-3xl">
          Insights and updates from the SkyNova Project Labs team on engineering, delivery
          and technology trends.
        </p>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                  category === c ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:border-blue-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {posts === null ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="text-lg font-semibold text-gray-900">No articles published yet</h2>
            <p className="text-gray-500 mt-1 max-w-md mx-auto">
              We&apos;re working on our first set of articles. Please check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((post) => (
              <Link
                key={post.id || post.title}
                to={post.slug ? `/blog/${post.slug}` : "/blog"}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {post.cover_image && (
                  <img src={post.cover_image} alt="" className="h-40 w-full object-cover" />
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {post.category && (
                      <span className="text-xs uppercase tracking-wide text-blue-600 font-medium">{post.category}</span>
                    )}
                    {post.is_featured && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Featured</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>
                  {post.excerpt && <p className="text-gray-600 text-sm leading-relaxed flex-1">{post.excerpt}</p>}
                  <div className="mt-4 text-xs text-gray-500">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
                    {post.author ? ` · by ${post.author}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

export default Blog