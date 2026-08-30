import React, { useCallback, useEffect, useState } from "react"
import {
  createCaseStudy,
  deleteCaseStudy,
  fetchAdminCaseStudies,
  updateCaseStudy,
  CaseStudy,
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
  Textarea,
  Modal,
  ConfirmDialog,
  StateError,
  EmptyState,
  useToastAction,
} from "../../components/ui"

const CaseStudies: React.FC = () => {
  const run = useToastAction()
  const [items, setItems] = useState<CaseStudy[]>([])
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ project_id: "", summary: "", is_published: false })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    return fetchAdminCaseStudies().then(setItems)
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const save = () => {
    const pid = Number(form.project_id)
    if (!pid) return
    const payload = {
      project_id: pid,
      solution: form.summary || null,
      is_published: form.is_published,
    } as Partial<CaseStudy>
    run(async () => {
      editingId ? await updateCaseStudy(editingId, payload) : await createCaseStudy(payload)
      setModal(false)
      await load()
    }, { success: "Case study saved" })
  }

  const publish = (cs: CaseStudy) => {
    run(async () => {
      await updateCaseStudy(cs.id, { is_published: !cs.is_published })
      await load()
    }, { success: cs.is_published ? "Unpublished" : "Published" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="Case Studies"
          subtitle="Client stories shown on the public site (linked to projects)."
          actions={<Button onClick={() => { setForm({ project_id: "", summary: "", is_published: false }); setEditingId(null); setModal(true) }}>+ New case study</Button>}
        />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (items.length === 0 ? (
          <EmptyState title="No case studies yet" description="Create one linked to an existing project." />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Solution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {items.map((cs) => (
                  <TableRow key={cs.id}>
                    <TableCell className="font-medium text-gray-900">
                      #{cs.project_id}{cs.project_title ? ` — ${cs.project_title}` : ""}
                    </TableCell>
                    <TableCell className="max-w-md truncate">{cs.solution || cs.impact || "—"}</TableCell>
                    <TableCell>
                      {cs.is_published ? <Badge className="bg-green-100 text-green-800">Published</Badge> : <Badge className="bg-gray-100 text-gray-600">Draft</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" className="mr-2" onClick={() => publish(cs)}>
                        {cs.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(cs.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        ))}

        <Modal open={modal} onClose={() => setModal(false)} title={editingId ? "Edit case study" : "New case study"}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pid" required>Project ID</Label>
              <Input id="pid" type="number" value={form.project_id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, project_id: e.target.value }))} placeholder="123" />
            </div>
            <div>
              <Label htmlFor="psum">Solution summary</Label>
              <Textarea id="psum" rows={3} value={form.summary} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
              Publish immediately
            </label>
            <Button className="w-full" onClick={save}>Save</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          title="Delete case study"
          message="Delete this case study? This cannot be undone."
          destructive
          onCancel={() => setDeleteId(null)}
          onConfirm={() => run(async () => { if (deleteId) await deleteCaseStudy(deleteId); setDeleteId(null); await load() }, { success: "Deleted" })}
        />
      </div>
    </main>
  )
}

export default CaseStudies