import React, { useCallback, useEffect, useState } from "react"
import {
  createAchievement,
  createFaq,
  createPartner,
  createTeamMember,
  createTestimonial,
  deleteAchievement,
  deleteFaq,
  deletePartner,
  deleteTeamMember,
  deleteTestimonial,
  fetchAchievements,
  fetchFaqs,
  fetchPartners,
  fetchTeam,
  fetchTestimonials,
  updateAchievement,
  updateFaq,
  updatePartner,
  updateTeamMember,
  updateTestimonial,
} from "../../services/api"
import {
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Button,
  Input,
  Label,
  Textarea,
  Modal,
  ConfirmDialog,
  StateError,
  EmptyState,
  useToastAction,
} from "../../components/ui"

type TabKey = "faqs" | "testimonials" | "team" | "partners" | "achievements"

interface ContentRow {
  id: number
  name: string
  title?: string | null
  question?: string | null
  answer?: string | null
  content?: string | null
  body?: string | null
  bio?: string | null
  description?: string | null
  category?: string | null
  role?: string | null
  company?: string | null
}

const tabMeta: Record<TabKey, { label: string; singular: string; heading: (r: ContentRow) => string; body: (r: ContentRow) => string }> = {
  faqs: { label: "FAQs", singular: "FAQ", heading: (r) => r.question || r.name, body: (r) => r.answer || "" },
  testimonials: { label: "Testimonials", singular: "Testimonial", heading: (r) => r.name, body: (r) => r.content || "" },
  team: { label: "Team", singular: "Member", heading: (r) => r.name, body: (r) => r.body || r.bio || "" },
  partners: { label: "Partners", singular: "Partner", heading: (r) => r.name, body: (r) => r.description || "" },
  achievements: { label: "Achievements", singular: "Achievement", heading: (r) => r.title || r.name, body: (r) => r.description || "" },
}

const SiteContent: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<TabKey>("faqs")
  const [lists, setLists] = useState<Record<TabKey, ContentRow[]>>({ faqs: [], testimonials: [], team: [], partners: [], achievements: [] })
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ heading: "", body: "", category: "" })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      fetchFaqs().catch(() => []),
      fetchTestimonials().catch(() => []),
      fetchTeam().catch(() => []),
      fetchPartners().catch(() => []),
      fetchAchievements().catch(() => []),
    ]).then(([faqs, testimonials, team, partners, achievements]) => {
      setLists({
        faqs: faqs.map((f) => ({ id: f.id, name: f.question, question: f.question, answer: f.answer, category: f.category ?? null })),
        testimonials: testimonials.map((t) => ({ id: t.id, name: t.name, content: t.content, category: t.company ?? null, role: t.role ?? null })),
        team: team.map((m) => ({ id: m.id, name: m.name, bio: m.bio ?? null, category: m.department ?? null })),
        partners: partners.map((p) => ({ id: p.id, name: p.name, description: p.description ?? null, category: p.partner_type ?? null })),
        achievements: achievements.map((a) => ({ id: a.id, title: a.title, name: a.title, description: a.description ?? null, category: a.category ?? null })),
      })
    })
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const meta = tabMeta[tab]

  const openAdd = () => {
    setForm({ heading: "", body: "", category: "" })
    setEditingId(null)
    setModal(true)
  }

  const openEdit = (r: ContentRow) => {
    setForm({ heading: meta.heading(r), body: meta.body(r), category: r.category || "" })
    setEditingId(r.id)
    setModal(true)
  }

  const save = () => {
    if (!form.heading.trim()) return
    const name = form.heading.trim()
    run(async () => {
      if (tab === "faqs") {
        const p = { question: name, answer: form.body.trim() || "—", category: form.category || null }
        editingId ? await updateFaq(editingId, p) : await createFaq(p)
      } else if (tab === "testimonials") {
        const p = { name, content: form.body.trim() || "—", company: form.category || null }
        editingId ? await updateTestimonial(editingId, p) : await createTestimonial(p)
      } else if (tab === "team") {
        const p = { name, bio: form.body.trim() || null, department: form.category || null }
        editingId ? await updateTeamMember(editingId, p) : await createTeamMember(p)
      } else if (tab === "partners") {
        const p = { name, description: form.body.trim() || null, partner_type: form.category || null }
        editingId ? await updatePartner(editingId, p) : await createPartner(p)
      } else {
        const p = { title: name, description: form.body.trim() || null, category: form.category || null }
        editingId ? await updateAchievement(editingId, p) : await createAchievement(p)
      }
      setModal(false)
      await load()
    }, { success: "Saved" })
  }

  const remove = () => {
    if (!deleteId) return
    run(async () => {
      if (tab === "faqs") await deleteFaq(deleteId)
      else if (tab === "testimonials") await deleteTestimonial(deleteId)
      else if (tab === "team") await deleteTeamMember(deleteId)
      else if (tab === "partners") await deletePartner(deleteId)
      else await deleteAchievement(deleteId)
      setDeleteId(null)
      await load()
    }, { success: "Deleted" })
  }

  const headLabel: Record<TabKey, string> = { faqs: "Question", testimonials: "Name", team: "Name", partners: "Name", achievements: "Title" }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Site Content" subtitle="FAQs, testimonials, team, partners and achievements displayed on the public site." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (
          <Tabs>
            <TabsList>
              {(Object.keys(tabMeta) as TabKey[]).map((k) => (
                <TabsTrigger key={k} active={tab === k} onClick={() => setTab(k)}>{tabMeta[k].label}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent active>
              <div className="flex justify-end mb-4">
                <Button onClick={openAdd}>+ Add {meta.singular.toLowerCase()}</Button>
              </div>
              {lists[tab].length === 0 ? (
                <EmptyState title={`No ${meta.label.toLowerCase()} yet`} />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{headLabel[tab]}</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {lists[tab].map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-gray-900 max-w-xs">{meta.heading(r)}</TableCell>
                          <TableCell className="max-w-md truncate">{meta.body(r)}</TableCell>
                          <TableCell>{r.category || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="secondary" size="sm" className="mr-2" onClick={() => openEdit(r)}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(r.id)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Modal open={modal} onClose={() => setModal(false)} title={`${editingId ? "Edit" : "Add"} ${meta.singular.toLowerCase()}`}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ch" required>{headLabel[tab]}</Label>
              <Input id="ch" value={form.heading} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, heading: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cb">Body</Label>
              <Textarea id="cb" rows={3} value={form.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, body: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cc">Category / company</Label>
              <Input id="cc" value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={save}>{editingId ? "Save changes" : "Create"}</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          title="Delete item"
          message="Delete this content item? This cannot be undone."
          destructive
          onCancel={() => setDeleteId(null)}
          onConfirm={remove}
        />
      </div>
    </main>
  )
}

export default SiteContent