import React, { useCallback, useEffect, useState } from "react"
import {
  createBuildLog,
  createExperiment,
  createResearch,
  deleteBuildLog,
  deleteExperiment,
  deleteResearch,
  fetchAdminBuildLogs,
  fetchAdminExperiments,
  fetchAdminResearch,
  updateBuildLog,
  updateExperiment,
  updateResearch,
  BuildLogEntry,
  Experiment,
  Research,
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

type TabKey = "research" | "experiments" | "buildlogs"

interface RowLike { id: number; title: string; status?: string; is_public?: boolean }

const statusTone = (s?: string) => {
  const map: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-600", PLANNED: "bg-blue-100 text-blue-800", IN_PROGRESS: "bg-amber-100 text-amber-800", COMPLETED: "bg-green-100 text-green-800", PUBLISHED: "bg-green-100 text-green-800", PROGRESS: "bg-blue-100 text-blue-800" }
  return <Badge className={map[s || ""] || "bg-gray-100 text-gray-600"}>{s || "DRAFT"}</Badge>
}

const RDAdmin: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<TabKey>("research")
  const [research, setResearch] = useState<Research[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [buildlogs, setBuildlogs] = useState<BuildLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({ title: "", body: "", status: "", is_public: true })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      fetchAdminResearch().catch(() => []),
      fetchAdminExperiments().catch(() => []),
      fetchAdminBuildLogs().catch(() => []),
    ]).then(([r, e, b]) => { setResearch(r); setExperiments(e); setBuildlogs(b) })
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const rows: RowLike[] = tab === "research" ? research : tab === "experiments" ? experiments : buildlogs

  const openAdd = () => {
    setForm({ title: "", body: "", status: tab === "research" ? "DRAFT" : tab === "experiments" ? "PLANNED" : "PROGRESS", is_public: true })
    setEditingId(null)
    setModal(true)
  }

  const openEdit = (r: RowLike) => {
    setForm({ title: r.title, body: "", status: r.status || (tab === "research" ? "DRAFT" : "PLANNED"), is_public: r.is_public ?? true })
    setEditingId(r.id)
    setModal(true)
  }

  const save = () => {
    if (!form.title.trim()) return
    const runSave = async () => {
      if (tab === "research") {
        const p = { title: form.title.trim(), category: form.body.trim() || null, status: form.status || "DRAFT", is_public: form.is_public } as Partial<Research>
        editingId ? await updateResearch(editingId, p) : await createResearch(p)
      } else if (tab === "experiments") {
        const p = { title: form.title.trim(), objective: form.body.trim() || null, status: form.status || "PLANNED", is_public: form.is_public } as Partial<Experiment>
        editingId ? await updateExperiment(editingId, p) : await createExperiment(p)
      } else {
        const p = { title: form.title.trim(), entry_type: form.status || "PROGRESS", description: form.body.trim() || null, is_public: form.is_public, entry_date: new Date().toISOString().split("T")[0] } as Partial<BuildLogEntry>
        editingId ? await updateBuildLog(editingId, p) : await createBuildLog(p)
      }
      setModal(false)
      await load()
    }
    run(runSave, { success: "Saved" })
  }

  const remove = () => {
    if (!deleteId) return
    run(async () => {
      if (tab === "research") await deleteResearch(deleteId)
      else if (tab === "experiments") await deleteExperiment(deleteId)
      else await deleteBuildLog(deleteId)
      setDeleteId(null)
      await load()
    }, { success: "Deleted" })
  }

  const statusOptions = tab === "research"
    ? ["DRAFT", "IN_PROGRESS", "COMPLETED"]
    : tab === "experiments"
      ? ["PLANNED", "IN_PROGRESS", "COMPLETED"]
      : ["PROGRESS", "COMPLETED"]

  const bodyLabel = tab === "research" ? "Category" : tab === "experiments" ? "Objective" : "Description"

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Research & Development" subtitle="Research papers, experiments and build logs for the public site." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (
          <Tabs>
            <TabsList>
              <TabsTrigger active={tab === "research"} onClick={() => setTab("research")}>Research</TabsTrigger>
              <TabsTrigger active={tab === "experiments"} onClick={() => setTab("experiments")}>Experiments</TabsTrigger>
              <TabsTrigger active={tab === "buildlogs"} onClick={() => setTab("buildlogs")}>Build logs</TabsTrigger>
            </TabsList>

            <TabsContent active>
              <div className="flex justify-end mb-4">
                <Button onClick={openAdd}>+ New {tab === "buildlogs" ? "build log" : tab === "experiments" ? "experiment" : "research entry"}</Button>
              </div>
              {rows.length === 0 ? <EmptyState title="Nothing here yet" /> : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-gray-900 max-w-md truncate">{r.title}</TableCell>
                          <TableCell>{statusTone(r.status)}</TableCell>
                          <TableCell>{r.is_public ? <Badge className="bg-blue-100 text-blue-800">Public</Badge> : <Badge className="bg-gray-100 text-gray-600">Hidden</Badge>}</TableCell>
                          <TableCell className="text-xs text-gray-500">—</TableCell>
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

        <Modal open={modal} onClose={() => setModal(false)} title={`${editingId ? "Edit" : "New"} ${tab === "buildlogs" ? "build log" : tab.slice(0, -1)}`}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rdh" required>Title</Label>
              <Input id="rdh" value={form.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="rdb">{bodyLabel}</Label>
              <Textarea id="rdb" rows={3} value={form.body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, body: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="rds">Status</Label>
              <select id="rds" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
              Visible on public site
            </label>
            <Button className="w-full" onClick={save}>{editingId ? "Save changes" : "Create"}</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          title="Delete entry"
          message="Delete this entry? This cannot be undone."
          destructive
          onCancel={() => setDeleteId(null)}
          onConfirm={remove}
        />
      </div>
    </main>
  )
}

export default RDAdmin