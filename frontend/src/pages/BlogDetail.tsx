import React, { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { fetchPublicBlogPost, CmsBlogPost } from "../services/api"

const BlogDetail: React.FC = () => {
  const { slug = "" } = useParams()
  const [post, setPost] = useState<CmsBlogPost | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPublicBlogPost(slug)
      .then(setPost)
      .catch((e) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/blog" className="btn-primary">Back to Blog</Link>
        </div>
      </main>
    )
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-1/3 mb-6 animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />)}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <article className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/blog" className="text-sm text-blue-600 hover:underline">← Back to Blog</Link>
        {post.cover_image && <img src={post.cover_image} alt="" className="w-full h-56 object-cover rounded-lg shadow mt-4 mb-6" />}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          {post.category && <span className="text-blue-600 font-medium uppercase tracking-wide">{post.category}</span>}
          {post.is_featured && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Featured</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
        <div className="text-sm text-gray-500 mb-8">
          {post.published_at ? `Published ${new Date(post.published_at).toLocaleDateString()}` : "Unpublished"}
          {post.author ? ` · by ${post.author}` : ""}
        </div>
        {post.excerpt && <p className="text-lg text-gray-600 leading-relaxed mb-6">{post.excerpt}</p>}
        <div className="prose prose-slate max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
          {post.content}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8">
            {post.tags.map((t) => (
              <span key={t} className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-600">#{t}</span>
            ))}
          </div>
        )}
      </article>
    </main>
  )
}

export default BlogDetail