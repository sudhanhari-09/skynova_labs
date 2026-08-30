import React, { useEffect, useState } from "react"
import { PageHeader, Spinner, StateError, EmptyState, Table, TableHeader, TableRow, TableCell, TableHead, Button, Modal, Input, Label, Textarea, FieldError, StatusBadge, ConfirmDialog, Alert } from "../../components/ui"
import {
  listProjectTypes, createProjectType, updateProjectType, deleteProjectType,
  listSubcategories, createSubcategory,
  ProjectTypeSummary, ProjectSubcategorySummary,
} from "../../services/api"

const emptyType = { name: "", slug: "", description: "", display_order: 0 }

const ProjectTypesAdmin: React.FC = () => {
  const [types, setTypes] = useState<ProjectTypeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<ProjectTypeSummary | null>(null)
  const [form, setForm] = useState(emptyType)
  const [formError, setFormError] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState<ProjectTypeSummary | null>(null)

  const [subsFor, setSubsFor] = useState<ProjectTypeSummary | null>(null)
  const [subs, setSubs] = useState<ProjectSubcategorySummary[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [newSub, setNewSub] = useState({ name: "", slug: "", description: "" })
  const [subError, setSubError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setTypes(await listProjectTypes())
    } catch (e: any) {
      setError(e.message || "Could not load project types.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyType)
    setFormError({})
    setModal(true)
  }

  const openEdit = (t: ProjectTypeSummary) => {
    setEditing(t)
    setForm({ name: t.name, slug: t.slug, description: t.description || "", display_order: t.display_order })
    setFormError({})
    setModal(true)
  }

  const handleSave = async () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = "Name is required."
    if (!form.slug.trim()) errs.slug = "Slug is required."
    else if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = "Slug must be lowercase letters, numbers and dashes."
    setFormError(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const payload = { ...form, display_order: Number(form.display_order) || 0 }
      if (editing) await updateProjectType(editing.id, payload)
      else await createProjectType(payload)
      setModal(false)
      await load()
    } catch (e: any) {
      setFormError({ _general: e.message || "Could not save project type." })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteProjectType(deleting.id)
      setDeleting(null)
      await load()
    } catch (e: any) {
      setError(e.message || "Could not deactivate project type.")
      setDeleting(null)
    }
  }

  const openSubs = async (t: ProjectTypeSummary) => {
    setSubsFor(t)
    setSubs([])
    setNewSub({ name: "", slug: "", description: "" })
    setSubError(null)
    try {
      setSubsLoading(true)
      setSubs(await listSubcategories(t.id))
    } catch (e: any) {
      setSubError(e.message || "Could not load subcategories.")
    } finally {
      setSubsLoading(false)
    }
  }

  const addSub = async () => {
    if (!subsFor) return
    if (!newSub.name.trim() || !newSub.slug.trim()) {
      setSubError("Name and slug are required.")
      return
    }
    setSubError(null)
    try {
      await createSubcategory(subsFor.id, newSub)
      setNewSub({ name: "", slug: "", description: "" })
      setSubs(await listSubcategories(subsFor.id))
    } catch (e: any) {
      setSubError(e.message || "Could not create subcategory.")
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="Project Types"
          subtitle="Catalog of services used by the public quote form"
          actions={<Button onClick={openCreate}>+ New Project Type</Button>}
        />

        {loading && (
          <div className="py-16">
            <Spinner className="mx-auto" label="Loading project types…" />
          </div>
        )}

        {!loading && error && <StateError message={error} onRetry={load} />}

        {!loading && !error && types.length === 0 && (
          <EmptyState
            icon="📂"
            title="No project types yet"
            description="Create your first project type so the public quote form can catalogue services."
          />
        )}

        {!loading && !error && types.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium text-gray-900">{t.name}</div>
                      {t.description && <div className="text-xs text-gray-500">{t.description}</div>}
                    </TableCell>
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.slug}</code></TableCell>
                    <TableCell>{t.display_order}</TableCell>
                    <TableCell><StatusBadge status={t.is_active ? "ACTIVE" : "INACTIVE"} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openSubs(t)}>Subcategories</Button>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(t)}>Edit</Button>
                        {t.is_active && (
                          <Button variant="danger" size="sm" onClick={() => setDeleting(t)}>Deactivate</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Create/Edit modal */}
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title={editing ? `Edit ${editing.name}` : "New Project Type"}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving}>{editing ? "Save changes" : "Create"}</Button>
            </>
          }
        >
          {formError._general && <Alert className="mb-4">{formError._general}</Alert>}
          <div className="space-y-4">
            <div>
              <Label htmlFor="pt-name" required>Name</Label>
              <Input id="pt-name" value={form.name} invalid={!!formError.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <FieldError>{formError.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="pt-slug" required>Slug</Label>
              <Input id="pt-slug" value={form.slug} invalid={!!formError.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              <FieldError>{formError.slug}</FieldError>
            </div>
            <div>
              <Label htmlFor="pt-desc">Description</Label>
              <Textarea id="pt-desc" rows={3} value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="pt-order">Display order</Label>
              <Input id="pt-order" type="number" value={form.display_order}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} />
            </div>
          </div>
        </Modal>

        {/* Subcategories modal */}
        <Modal
          open={!!subsFor}
          onClose={() => setSubsFor(null)}
          title={subsFor ? `Subcategories — ${subsFor.name}` : "Subcategories"}
          width="640px"
        >
          {subError && <Alert className="mb-4">{subError}</Alert>}
          {subsLoading ? (
            <div className="py-8"><Spinner className="mx-auto" label="Loading…" /></div>
          ) : subs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No subcategories yet for this project type.</p>
          ) : (
            <ul className="mb-6 space-y-2">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-md px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
                  </div>
                  <StatusBadge status={s.is_active ? "ACTIVE" : "INACTIVE"} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Input placeholder="Name" value={newSub.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSub((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Slug" value={newSub.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSub((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <Textarea rows={2} placeholder="Description (optional)" value={newSub.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSub((f) => ({ ...f, description: e.target.value }))} />
            <Button variant="secondary" size="sm" className="mt-3" onClick={addSub}>+ Add subcategory</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleting}
          title="Deactivate project type?"
          message={`This will set "${deleting?.name}" to inactive and remove it from the public quote form.`}
          confirmLabel="Deactivate"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      </div>
    </main>
  )
}

export default ProjectTypesAdmin
