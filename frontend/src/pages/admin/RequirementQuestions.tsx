import React, { useEffect, useMemo, useState } from "react"
import { PageHeader, Spinner, StateError, EmptyState, Table, TableHeader, TableRow, TableCell, TableHead, Button, Modal, Input, Label, Textarea, Select, FieldError, StatusBadge, ConfirmDialog, Alert } from "../../components/ui"
import {
  listProjectTypes, listSubcategories,
  listRequirementQuestions, createRequirementQuestion, updateRequirementQuestion, toggleRequirementQuestion,
  ProjectTypeSummary, ProjectSubcategorySummary, RequirementQuestion,
} from "../../services/api"

const FIELD_TYPES = ["text", "textarea", "number", "select", "multi-select", "radio", "checkbox", "date", "url"]

const emptyQuestion = {
  question: "",
  field_key: "",
  field_type: "text",
  is_required: true,
  options: "",
  display_order: 0,
  project_type_id: "" as string,
  subcategory_id: "" as string,
}

const RequirementQuestionsAdmin: React.FC = () => {
  const [questions, setQuestions] = useState<RequirementQuestion[]>([])
  const [types, setTypes] = useState<ProjectTypeSummary[]>([])
  const [subs, setSubs] = useState<ProjectSubcategorySummary[]>([])
  const [filterType, setFilterType] = useState("")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<RequirementQuestion | null>(null)
  const [form, setForm] = useState(emptyQuestion)
  const [formError, setFormError] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [toggleTarget, setToggleTarget] = useState<RequirementQuestion | null>(null)

  const loadTypes = async () => {
    try {
      setTypes(await listProjectTypes())
    } catch (_) {
      setTypes([])
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const typeId = filterType ? Number(filterType) : undefined
      const data = await listRequirementQuestions(typeId)
      setQuestions(data)
    } catch (e: any) {
      setError(e.message || "Could not load requirement questions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTypes()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType])

  // Load subcategories when a project type is chosen in the form modal.
  useEffect(() => {
    const typeId = Number(form.project_type_id)
    if (!typeId) {
      setSubs([])
      return
    }
    listSubcategories(typeId).then(setSubs).catch(() => setSubs([]))
  }, [form.project_type_id])

  const typeName = useMemo(
    () => types.find((t) => String(t.id) === form.project_type_id)?.name || "",
    [types, form.project_type_id]
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyQuestion)
    setFormError({})
    setModal(true)
  }

  const openEdit = (q: RequirementQuestion) => {
    setEditing(q)
    setForm({
      question: q.question,
      field_key: q.field_key,
      field_type: q.field_type,
      is_required: q.is_required,
      options: Array.isArray(q.options) ? q.options.join(", ") : "",
      display_order: q.display_order,
      project_type_id: q.project_type_id ? String(q.project_type_id) : "",
      subcategory_id: q.subcategory_id ? String(q.subcategory_id) : "",
    })
    setFormError({})
    setModal(true)
  }

  const handleSave = async () => {
    const errs: Record<string, string> = {}
    if (!form.question.trim()) errs.question = "Question is required."
    if (!form.field_key.trim()) errs.field_key = "Field key is required."
    else if (!/^[a-z0-9_]+$/.test(form.field_key)) errs.field_key = "Use lowercase letters, numbers and underscores."
    if (!form.project_type_id && !form.subcategory_id) errs.project_type_id = "Link to a project type or subcategory."
    setFormError(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const payload = {
        question: form.question,
        field_key: form.field_key,
        field_type: form.field_type,
        is_required: form.is_required,
        options: form.options ? form.options.split(",").map((s) => s.trim()).filter(Boolean) : null,
        display_order: Number(form.display_order) || 0,
        project_type_id: form.project_type_id ? Number(form.project_type_id) : null,
        subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
      }
      if (editing) await updateRequirementQuestion(editing.id, payload)
      else await createRequirementQuestion(payload as any)
      setModal(false)
      await load()
    } catch (e: any) {
      setFormError({ _general: e.message || "Could not save question." })
    } finally {
      setSaving(false)
    }
  }

  const confirmToggle = async () => {
    if (!toggleTarget) return
    try {
      await toggleRequirementQuestion(toggleTarget.id)
      setToggleTarget(null)
      await load()
    } catch (e: any) {
      setError(e.message || "Could not toggle question.")
      setToggleTarget(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="Requirement Questions"
          subtitle="Questions used to gather detailed requirements per project type"
          actions={<Button onClick={openCreate}>+ New Question</Button>}
        />

        <div className="mb-4 max-w-xs">
          <Label htmlFor="filter-type">Filter by project type</Label>
          <Select id="filter-type" value={filterType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value)}>
            <option value="">All project types</option>
            {types.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </Select>
        </div>

        {loading && (
          <div className="py-16">
            <Spinner className="mx-auto" label="Loading questions…" />
          </div>
        )}

        {!loading && error && <StateError message={error} onRetry={load} />}

        {!loading && !error && questions.length === 0 && (
          <EmptyState
            icon="❓"
            title="No questions found"
            description="Add requirement questions to capture detailed information during the quoting process."
          />
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Req</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-xs">
                      <div className="font-medium text-gray-900">{q.question}</div>
                      {q.options && q.options.length > 0 && (
                        <div className="text-xs text-gray-500">{q.options.join(", ")}</div>
                      )}
                    </TableCell>
                    <TableCell><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{q.field_key}</code></TableCell>
                    <TableCell><StatusBadge status={q.field_type.toUpperCase()} /></TableCell>
                    <TableCell>{q.is_required ? "Yes" : "No"}</TableCell>
                    <TableCell>{q.display_order}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {q.project_type_id ? `Type #${q.project_type_id}` : q.subcategory_id ? `Subcat #${q.subcategory_id}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(q)}>Edit</Button>
                        <Button variant={q.is_active ? "danger" : "secondary"} size="sm" onClick={() => setToggleTarget(q)}>
                          {q.is_active ? "Deactivate" : "Activate"}
                        </Button>
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
          title={editing ? "Edit Question" : "New Requirement Question"}
          width="640px"
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
              <Label htmlFor="q-question" required>Question</Label>
              <Textarea id="q-question" rows={2} value={form.question} invalid={!!formError.question}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, question: e.target.value }))} />
              <FieldError>{formError.question}</FieldError>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="q-key" required>Field key</Label>
                <Input id="q-key" value={form.field_key} invalid={!!formError.field_key}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, field_key: e.target.value }))} />
                <FieldError>{formError.field_key}</FieldError>
              </div>
              <div>
                <Label htmlFor="q-type" required>Field type</Label>
                <Select id="q-type" value={form.field_type}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, field_type: e.target.value }))}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="q-type-id">Project type</Label>
                <Select id="q-type-id" value={form.project_type_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, project_type_id: e.target.value, subcategory_id: "" }))}>
                  <option value="">None</option>
                  {types.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </Select>
                <FieldError>{formError.project_type_id}</FieldError>
              </div>
              <div>
                <Label htmlFor="q-sub-id">Subcategory</Label>
                <Select id="q-sub-id" value={form.subcategory_id} disabled={!form.project_type_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((f) => ({ ...f, subcategory_id: e.target.value }))}>
                  <option value="">{form.project_type_id ? `Subcategories of ${typeName}` : "Select a project type first"}</option>
                  {subs.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="q-options">Options (comma-separated)</Label>
                <Input id="q-options" value={form.options}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, options: e.target.value }))} placeholder="Option A, Option B" />
              </div>
              <div>
                <Label htmlFor="q-order">Display order</Label>
                <Input id="q-order" type="number" value={form.display_order}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_required}
                onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))} />
              Required field
            </label>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!toggleTarget}
          title={toggleTarget?.is_active ? "Deactivate question?" : "Activate question?"}
          message={`"${toggleTarget?.question}" will be ${toggleTarget?.is_active ? "hidden from" : "added to"} the quoting process.`}
          confirmLabel={toggleTarget?.is_active ? "Deactivate" : "Activate"}
          destructive={toggleTarget?.is_active}
          onConfirm={confirmToggle}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </main>
  )
}

export default RequirementQuestionsAdmin
