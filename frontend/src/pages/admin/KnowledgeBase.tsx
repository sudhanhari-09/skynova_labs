import React, { useCallback, useEffect, useState } from "react"
import {
  fetchKnowledgeCategories,
  fetchKnowledgeArticles,
  createKnowledgeCategory,
  deleteKnowledgeCategory,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  deleteKnowledgeArticle,
  KnowledgeCategory,
  KnowledgeArticle,
} from "../../services/api"
import {
  PageHeader,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Badge,
  Button,
  Input,
  Label,
  EmptyState,
  Skeleton,
  StateError,
  ConfirmDialog,
  useToastAction,
} from "../../components/ui"

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—")

const visTone = (v?: string) => (v === "PUBLIC" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800")

const KnowledgeBase: React.FC = () => {
  const run = useToastAction()
  const [categories, setCategories] = useState<KnowledgeCategory[] | null>(null)
  const [articles, setArticles] = useState<KnowledgeArticle[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState("")
  const [search, setSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<{ type: "article" | "category"; item: any } | null>(null)

  const [catForm, setCatForm] = useState({ name: "", description: "" })
  const [artForm, setArtForm] = useState({ title: "", category_id: "", content: "", visibility: "INTERNAL", is_published: false })

  const load = useCallback(() => {
    return Promise.all([
      fetchKnowledgeCategories().catch(() => []),
      fetchKnowledgeArticles(catFilter ? Number(catFilter) : undefined, search || undefined).catch(() => []),
    ]).then(([c, a]) => { setCategories(c); setArticles(a) })
  }, [catFilter, search])

  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const createCat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!catForm.name.trim()) return
    run(async () => {
      await createKnowledgeCategory(catForm)
      setCatForm({ name: "", description: "" })
      await load()
    }, { success: "Category created" })
  }

  const createArt = (e: React.FormEvent) => {
    e.preventDefault()
    if (!artForm.title.trim()) return
    run(async () => {
      await createKnowledgeArticle({
        title: artForm.title.trim(),
        category_id: artForm.category_id ? Number(artForm.category_id) : undefined,
        content: artForm.content,
        visibility: artForm.visibility,
        is_published: artForm.is_published,
      })
      setArtForm({ title: "", category_id: "", content: "", visibility: "INTERNAL", is_published: false })
      await load()
    }, { success: "Article created" })
  }

  const togglePublish = (a: KnowledgeArticle) => {
    run(async () => {
      await updateKnowledgeArticle(a.id, { is_published: !a.is_published })
      await load()
    }, { success: a.is_published ? "Unpublished" : "Published" })
  }

  const doDelete = () => {
    if (!confirmDelete) return
    run(async () => {
      if (confirmDelete.type === "article") await deleteKnowledgeArticle(confirmDelete.item.id)
      else await deleteKnowledgeCategory(confirmDelete.item.id)
      setConfirmDelete(null)
      await load()
    }, { success: "Deleted" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Knowledge Base" subtitle="Internal wiki, playbooks, SOPs and shared documentation." />

        {error && <StateError message={error} onRetry={load} />}

        <div className="flex flex-wrap gap-3 mb-6">
          <Input className="max-w-xs" placeholder="Search articles…" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm">
            <option value="">All categories</option>
            {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button className="btn btn-outline" onClick={load}>Refresh</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <form onSubmit={createCat} className="bg-white rounded-lg shadow p-5">
            <div className="font-semibold mb-3">New category</div>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={catForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm({ ...catForm, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={catForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCatForm({ ...catForm, description: e.target.value })} /></div>
              <Button className="btn btn-primary">+ Add Category</Button>
            </div>
            {categories && categories.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <div className="text-xs font-medium text-gray-500 uppercase mb-2">Categories</div>
                <div className="space-y-1.5">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-800">{c.name}</span>
                      <Button className="btn btn-outline btn-xs text-red-600" onClick={() => setConfirmDelete({ type: "category", item: c })}>Delete</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          <form onSubmit={createArt} className="bg-white rounded-lg shadow p-5 lg:col-span-2">
            <div className="font-semibold mb-3">New article</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div><Label>Title *</Label><Input value={artForm.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArtForm({ ...artForm, title: e.target.value })} /></div>
              <div><Label>Category</Label>
                <select value={artForm.category_id} onChange={(e) => setArtForm({ ...artForm, category_id: e.target.value })} className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
                  <option value="">None</option>
                  {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><Label>Visibility</Label>
                <select value={artForm.visibility} onChange={(e) => setArtForm({ ...artForm, visibility: e.target.value })} className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
                  <option value="INTERNAL">INTERNAL</option><option value="PUBLIC">PUBLIC</option>
                </select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={artForm.is_published} onChange={(e) => setArtForm({ ...artForm, is_published: e.target.checked })} />
                  Published
                </label>
              </div>
            </div>
            <div className="mb-3"><Label>Content</Label><Input value={artForm.content} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArtForm({ ...artForm, content: e.target.value })} placeholder="Write the article body…" /></div>
            <Button className="btn btn-primary">+ Create Article</Button>
          </form>
        </div>

        {!articles ? (
          <Skeleton className="h-64 w-full" />
        ) : articles.length === 0 ? (
          <EmptyState title="No articles yet" />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {articles.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}<div className="text-xs text-gray-400 mt-0.5">/knowledge/articles/{a.id}</div></TableCell>
                    <TableCell className="text-sm text-gray-600">{a.category?.name || "—"}</TableCell>
                    <TableCell><Badge className={visTone(a.visibility)}>{a.visibility}</Badge></TableCell>
                    <TableCell><Badge className={a.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{a.is_published ? "PUBLISHED" : "DRAFT"}</Badge></TableCell>
                    <TableCell className="text-sm">{a.version}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtTime(a.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button className="btn btn-outline btn-xs" onClick={() => togglePublish(a)}>{a.is_published ? "Unpublish" : "Publish"}</Button>
                        <Button className="btn btn-outline btn-xs text-red-600" onClick={() => setConfirmDelete({ type: "article", item: a })}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog open={!!confirmDelete} onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} title="Delete?" message={`Delete "${confirmDelete?.item?.name || confirmDelete?.item?.title}"?`} />
    </main>
  )
}

export default KnowledgeBase