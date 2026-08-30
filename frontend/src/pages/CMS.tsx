import React, { useCallback, useEffect, useState } from "react"
import {
  fetchAdminPages,
  fetchAdminBlog,
  createCmsPage,
  updateCmsPage,
  deleteCmsPage,
  createCmsSection,
  updateCmsSection,
  deleteCmsSection,
  createCmsBlog,
  updateCmsBlog,
  deleteCmsBlog,
  CmsPage,
  CmsSection,
  CmsBlogPost,
} from "../services/api"
import {
  PageHeader,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  EmptyState,
  Skeleton,
  StateError,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Modal,
  ConfirmDialog,
  useToastAction,
} from "../components/ui"

type SectionDraft = {
  section_key: string
  title: string
  content: string
  cta_text: string
  cta_url: string
  image_url: string
  display_order: number
  is_enabled: boolean
}

type Editor =
  | { kind: "page"; mode: "new" | "edit"; page: CmsPage | null }
  | { kind: "section"; page: CmsPage; section: CmsSection | null }
  | { kind: "post"; mode: "new" | "edit"; post: CmsBlogPost | null }
  | null

const fa = (v: string, fb: undefined) => (v.trim() ? v : fb)

const defaultSection: SectionDraft = {
  section_key: "hero",
  title: "",
  content: "",
  cta_text: "",
  cta_url: "",
  image_url: "",
  display_order: 0,
  is_enabled: true,
}

const CMS: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<"pages" | "blog">("pages")
  const [pages, setPages] = useState<CmsPage[] | null>(null)
  const [posts, setPosts] = useState<CmsBlogPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editor, setEditor] = useState<Editor>(null)
  const [pTitle, setPTitle] = useState("")
  const [pSlug, setPSlug] = useState("")
  const [pContent, setPContent] = useState("")
  const [pSeoTitle, setPSeoTitle] = useState("")
  const [pMetaDesc, setPMetaDesc] = useState("")
  const [pOrder, setPOrder] = useState(0)
  const [pPublished, setPPublished] = useState(false)
  const [pHomepage, setPHomepage] = useState(false)

  const [sDraft, setSDraft] = useState<SectionDraft>(defaultSection)

  const [postTitle, setPostTitle] = useState("")
  const [postSlug, setPostSlug] = useState("")
  const [postExcerpt, setPostExcerpt] = useState("")
  const [postContent, setPostContent] = useState("")
  const [postCategory, setPostCategory] = useState("News")
  const [postTags, setPostTags] = useState("")
  const [postCover, setPostCover] = useState("")
  const [postPublished, setPostPublished] = useState(false)
  const [postFeatured, setPostFeatured] = useState(false)

  const [confirm, setConfirm] = useState<{ type: "page" | "post" | "section"; id: number; label: string } | null>(null)

  const loadPages = useCallback(() => fetchAdminPages().then(setPages).catch((e) => setError(e.message)), [])
  const loadPosts = useCallback(() => fetchAdminBlog().then(setPosts).catch((e) => setError(e.message)), [])
  useEffect(() => { loadPages() }, [loadPages])
  useEffect(() => { loadPosts() }, [loadPosts])

  const openNewPage = () => {
    setPTitle(""); setPSlug(""); setPContent(""); setPSeoTitle(""); setPMetaDesc("")
    setPOrder(0); setPPublished(false); setPHomepage(false)
    setEditor({ kind: "page", mode: "new", page: null })
  }
  const openEditPage = (p: CmsPage) => {
    setPTitle(p.title); setPSlug(p.slug ?? ""); setPContent(p.content ?? "")
    setPSeoTitle(p.seo_title ?? ""); setPMetaDesc(p.meta_description ?? "")
    setPOrder(p.display_order ?? 0); setPPublished(p.is_published); setPHomepage(p.is_homepage)
    setEditor({ kind: "page", mode: "edit", page: p })
  }

  const savePage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pTitle.trim()) return
    const payload = {
      title: pTitle,
      slug: fa(pSlug, undefined),
      content: fa(pContent, undefined),
      seo_title: fa(pSeoTitle, undefined),
      meta_description: fa(pMetaDesc, undefined),
      is_published: pPublished,
      is_homepage: pHomepage,
      display_order: Number(pOrder) || 0,
    }
    run(async () => {
      const saved = editorPageMode === "new" ? await createCmsPage(payload as never) : await updateCmsPage(editorPage!.id, payload)
      setEditor({ kind: "page", mode: "edit", page: saved })
      await loadPages()
    }, { success: "Page saved" })
  }

  const openSection = (page: CmsPage, section: CmsSection | null) => {
    setSDraft(section ? {
      section_key: section.section_key, title: section.title ?? "", content: section.content ?? "",
      cta_text: section.cta_text ?? "", cta_url: section.cta_url ?? "", image_url: section.image_url ?? "",
      display_order: section.display_order ?? 0, is_enabled: section.is_enabled,
    } : defaultSection)
    setEditor({ kind: "section", page, section })
  }

  const saveSection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editor || editor.kind !== "section" || !sDraft.section_key.trim()) return
    const payload = {
      section_key: sDraft.section_key.trim(),
      title: fa(sDraft.title, undefined),
      content: fa(sDraft.content, undefined),
      cta_text: fa(sDraft.cta_text, undefined),
      cta_url: fa(sDraft.cta_url, undefined),
      image_url: fa(sDraft.image_url, undefined),
      display_order: Number(sDraft.display_order) || 0,
      is_enabled: sDraft.is_enabled,
    }
    run(async () => {
      const saved = editor.section
        ? await updateCmsSection(editor.section.id, payload)
        : await createCmsSection(editor.page.id, payload)
      openEditPage(saved)
      await loadPages()
    }, { success: "Section saved" })
  }

  const openNewPost = () => {
    setPostTitle(""); setPostSlug(""); setPostExcerpt(""); setPostContent("")
    setPostCategory("News"); setPostTags(""); setPostCover(""); setPostPublished(false); setPostFeatured(false)
    setEditor({ kind: "post", mode: "new", post: null })
  }
  const openEditPost = (p: CmsBlogPost) => {
    setPostTitle(p.title); setPostSlug(p.slug ?? ""); setPostExcerpt(p.excerpt ?? "")
    setPostContent(p.content ?? ""); setPostCategory(p.category ?? "News")
    setPostTags((p.tags ?? []).join(", ")); setPostCover(p.cover_image ?? "")
    setPostPublished(p.is_published); setPostFeatured(p.is_featured)
    setEditor({ kind: "post", mode: "edit", post: p })
  }

  const savePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!postTitle.trim()) return
    run(async () => {
      const payload = {
        title: postTitle,
        slug: fa(postSlug, undefined),
        excerpt: fa(postExcerpt, undefined),
        content: fa(postContent, undefined),
        category: fa(postCategory, undefined),
        tags: postTags.split(",").map((t) => t.trim()).filter(Boolean),
        cover_image: fa(postCover, undefined),
        is_published: postPublished,
        is_featured: postFeatured,
      }
      if (editorPostMode === "new") await createCmsBlog(payload as never)
      else await updateCmsBlog(editorPost!.id, payload)
      setEditor(null)
      await loadPosts()
    }, { success: "Post saved" })
  }

  const doDelete = () => {
    if (!confirm) return
    run(async () => {
      if (confirm.type === "page") await deleteCmsPage(confirm.id)
      else if (confirm.type === "post") await deleteCmsBlog(confirm.id)
      else await deleteCmsSection(confirm.id)
      setConfirm(null)
      if (confirm.type === "page") { setEditor(null); await loadPages() }
      else if (confirm.type === "post") { setEditor(null); await loadPosts() }
      else { await loadPages() }
    }, { success: "Deleted" })
  }

  const editorPage = editor?.kind === "page" ? editor.page : editor?.kind === "section" ? editor.page : null
  const editorSection = editor?.kind === "section" ? editor.section : null
  const editorPageMode = editor?.kind === "page" ? editor.mode : editor?.kind === "post" ? editor.mode : null
  const editorPost = editor?.kind === "post" ? editor.post : null
  const editorPostMode = editor?.kind === "post" ? editor.mode : null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Content Management" subtitle="Author pages, sections, and blog posts for the public site." />

        {error && <StateError message={error} onRetry={() => { loadPages(); loadPosts() }} />}

        <Tabs className="mb-6">
          <TabsList>
            <TabsTrigger active={tab === "pages"} onClick={() => setTab("pages")}>Pages</TabsTrigger>
            <TabsTrigger active={tab === "blog"} onClick={() => setTab("blog")}>Blog Posts</TabsTrigger>
          </TabsList>
        </Tabs>

        <TabsContent active={tab === "pages"}>
          <div className="flex justify-end mb-4">
            <Button className="btn btn-primary btn-sm" onClick={openNewPage}>+ New Page</Button>
          </div>
          {!pages ? (
            <Skeleton className="h-64 w-full" rows={6} />
          ) : pages.length === 0 ? (
            <EmptyState title="No pages yet" description="Create a page to start publishing content." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(pages as CmsPage[]).map((p) => (
                <div key={p.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold text-gray-900">{p.title}</div>
                      <div className="text-xs text-gray-500 font-mono">/{p.slug}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Badge className={p.is_published ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}>
                        {p.is_published ? "Published" : "Draft"}
                      </Badge>
                      {p.is_homepage && <Badge className="bg-blue-100 text-blue-800">Home</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">{p.content || p.meta_description || "No content yet."}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">{p.sections.length} sections</span>
                    <div className="flex gap-2">
                      <Button className="btn btn-outline btn-sm" onClick={() => openEditPage(p)}>Edit</Button>
                      <Button className="btn btn-outline btn-sm" onClick={() => setConfirm({ type: "page", id: p.id, label: p.title })}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent active={tab === "blog"}>
          <div className="flex justify-end mb-4">
            <Button className="btn btn-primary btn-sm" onClick={openNewPost}>+ New Post</Button>
          </div>
          {!posts ? (
            <Skeleton className="h-64 w-full" rows={6} />
          ) : posts.length === 0 ? (
            <EmptyState title="No posts yet" description="Write and publish your first blog entry." />
          ) : (
            <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
              {(posts as CmsBlogPost[]).map((p) => (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{p.title}</span>
                      {p.is_featured && <Badge className="bg-amber-100 text-amber-800">Featured</Badge>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.category} · by {p.author || "—"} · {p.published_at ? new Date(p.published_at).toLocaleDateString() : "unpublished"}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Badge className={p.is_published ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}>
                      {p.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Button className="btn btn-outline btn-sm" onClick={() => openEditPost(p)}>Edit</Button>
                    <Button className="btn btn-outline btn-sm" onClick={() => setConfirm({ type: "post", id: p.id, label: p.title })}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </div>

      {/* Page editor */}
      <Modal open={!!editor && editor.kind === "page"}
        onClose={() => setEditor(null)}
        title={editorPageMode === "new" ? "New Page" : `Edit ${editorPage?.title ?? ""}`}
        width="720px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)}>Cancel</Button>
            <Button className="btn btn-primary" onClick={savePage} disabled={!pTitle.trim()}>Save Page</Button>
          </>
        }>
        <form onSubmit={savePage} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={pTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Slug</Label>
              <Input value={pSlug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPSlug(e.target.value)} placeholder="auto-generated" />
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={String(pOrder)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPOrder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Body content</Label>
            <Textarea rows={5} value={pContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPContent(e.target.value)} placeholder="Markdown or HTML body" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>SEO title</Label>
              <Input value={pSeoTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPSeoTitle(e.target.value)} />
            </div>
            <div>
              <Label>Meta description</Label>
              <Input value={pMetaDesc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPMetaDesc(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pPublished} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPPublished(e.target.checked)} className="accent-blue-600" />
            Published (visible on public site)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pHomepage} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPHomepage(e.target.checked)} className="accent-blue-600" />
            Set as homepage
          </label>

          {editorPageMode === "edit" && editorPage && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Sections</span>
                <Button className="btn btn-outline btn-sm" onClick={() => openSection(editorPage, null)}>+ Add</Button>
              </div>
              {editorPage.sections.length === 0 ? (
                <p className="text-sm text-gray-500">No sections yet.</p>
              ) : (
                <div className="space-y-2">
                  {editorPage.sections.map((s) => (
                    <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-2.5">
                      <div>
                        <div className="font-mono text-sm font-medium text-gray-800">{s.section_key}</div>
                        <div className="text-xs text-gray-500">{s.title || "Untitled"}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button className="btn btn-outline btn-sm" onClick={() => openSection(editorPage, s)}>Edit</Button>
                        <Button className="btn btn-outline btn-sm text-red-600" onClick={() => setConfirm({ type: "section", id: s.id, label: s.section_key })}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Section editor */}
      <Modal open={!!editor && editor.kind === "section"}
        onClose={() => setEditor(null)}
        title={editorSection ? `Edit section ${editorSection.section_key}` : `Add section to ${editorPage?.title ?? ""}`}
        width="640px"
        footer={
          <>
            <Button variant="secondary" onClick={() => editorPage ? openEditPage(editorPage) : setEditor(null)}>Back</Button>
            <Button className="btn btn-primary" onClick={saveSection} disabled={!sDraft.section_key.trim()}>Save Section</Button>
          </>
        }>
        <form onSubmit={saveSection} className="space-y-4">
          <div>
            <Label>Section key *</Label>
            <Input value={sDraft.section_key} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, section_key: e.target.value })} placeholder="hero, features, contact …" />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={sDraft.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, title: e.target.value })} />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea rows={3} value={sDraft.content} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSDraft({ ...sDraft, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CTA text</Label>
              <Input value={sDraft.cta_text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, cta_text: e.target.value })} />
            </div>
            <div>
              <Label>CTA URL</Label>
              <Input value={sDraft.cta_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, cta_url: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={sDraft.image_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, image_url: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 items-end gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input type="checkbox" checked={sDraft.is_enabled} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, is_enabled: e.target.checked })} className="accent-blue-600" />
              Enabled
            </label>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={String(sDraft.display_order)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDraft({ ...sDraft, display_order: Number(e.target.value) || 0 })} />
            </div>
          </div>
          {editorSection && (
            <div className="flex justify-end">
              <Button className="btn btn-outline btn-sm text-red-600" onClick={() => setConfirm({ type: "section", id: editorSection.id, label: editorSection.section_key })}>Delete Section</Button>
            </div>
          )}
        </form>
      </Modal>

      {/* Post editor */}
      <Modal open={!!editor && editor.kind === "post"}
        onClose={() => setEditor(null)}
        title={editorPostMode === "new" ? "New Blog Post" : `Edit ${editorPost?.title ?? ""}`}
        width="720px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditor(null)}>Cancel</Button>
            <Button className="btn btn-primary" onClick={savePost} disabled={!postTitle.trim()}>Save Post</Button>
          </>
        }>
        <form onSubmit={savePost} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={postTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Slug</Label>
              <Input value={postSlug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostSlug(e.target.value)} placeholder="auto-generated" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={postCategory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostCategory(e.target.value)} placeholder="News, Product, Engineering…" />
            </div>
          </div>
          <div>
            <Label>Excerpt</Label>
            <Input value={postExcerpt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostExcerpt(e.target.value)} placeholder="Short summary shown in listings" />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea rows={6} value={postContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPostContent(e.target.value)} placeholder="Markdown or HTML body" />
          </div>
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={postTags} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostTags(e.target.value)} />
          </div>
          <div>
            <Label>Cover image URL</Label>
            <Input value={postCover} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostCover(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={postPublished} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostPublished(e.target.checked)} className="accent-blue-600" />
            Published (visible on public blog)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={postFeatured} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostFeatured(e.target.checked)} className="accent-blue-600" />
            Featured post
          </label>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirm} onConfirm={doDelete} onCancel={() => setConfirm(null)} destructive
        title={`Delete ${confirm?.type}`} message={`Delete "${confirm?.label}"? This cannot be undone.`} confirmLabel="Delete" />
    </main>
  )
}

export default CMS