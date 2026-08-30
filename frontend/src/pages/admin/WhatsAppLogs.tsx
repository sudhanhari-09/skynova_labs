import React, { useCallback, useEffect, useState } from "react"
import {
  fetchWhatsAppLogs,
  fetchWhatsAppTemplates,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  WhatsAppLog,
  WhatsAppTemplate,
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
  EmptyState,
  Skeleton,
  StateError,
  ConfirmDialog,
  useToastAction,
} from "../../components/ui"

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—")

const statusTone = (s?: string) => {
  switch (s) {
    case "SENT": return "bg-green-100 text-green-800"
    case "SIMULATED": return "bg-amber-100 text-amber-800"
    case "FAILED": return "bg-red-100 text-red-800"
    default: return "bg-gray-100 text-gray-600"
  }
}

const WhatsAppLogs: React.FC = () => {
  const run = useToastAction()
  const [logs, setLogs] = useState<WhatsAppLog[] | null>(null)
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null)
  const [tab, setTab] = useState("logs")
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppTemplate | null>(null)
  const [form, setForm] = useState({ name: "", body: "" })

  const load = useCallback(() => {
    return Promise.all([
      fetchWhatsAppLogs(150).catch(() => []),
      fetchWhatsAppTemplates().catch(() => []),
    ]).then(([l, t]) => {
      setLogs(l)
      setTemplates(t)
      return true
    })
  }, [])

  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.body.trim()) return
    run(async () => {
      await createWhatsAppTemplate({ name: form.name.trim(), body: form.body.trim() })
      setForm({ name: "", body: "" })
      await load()
    }, { success: "Template created" })
  }

  const doDelete = () => {
    if (!confirmDelete) return
    run(async () => {
      await deleteWhatsAppTemplate(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    }, { success: "Template deleted" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="WhatsApp Logs" subtitle="Audit trail of WhatsApp communications." />

        {error && <StateError message={error} onRetry={load} />}

        <Tabs className="mb-6">
          <TabsList>
            <TabsTrigger active={tab === "logs"} onClick={() => setTab("logs")}>Logs</TabsTrigger>
            <TabsTrigger active={tab === "templates"} onClick={() => setTab("templates")}>Templates</TabsTrigger>
          </TabsList>
        </Tabs>

        <TabsContent active={tab === "logs"}>
          {!logs ? (
            <Skeleton className="h-64 w-full" />
          ) : logs.length === 0 ? (
            <EmptyState title="No WhatsApp activity yet" description="Messaging is delivered via the Evolution API once configured; until then sends are simulated." />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Related</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-gray-500">{fmtTime(l.timestamp)}</TableCell>
                      <TableCell className="text-sm">{l.phone}</TableCell>
                      <TableCell><Badge className={statusTone(l.status)}>{l.status}</Badge></TableCell>
                      <TableCell className="text-xs text-gray-500">{l.provider || "—"}</TableCell>
                      <TableCell className="text-xs text-gray-500">{(l.related_entity || "") + (l.related_id ? ` #${l.related_id}` : "") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent active={tab === "templates"}>
          <form onSubmit={submit} className="bg-white rounded-lg shadow p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} placeholder="Re-engagement" /></div>
            <div><Label>Body *</Label><Input value={form.body} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{name}}, …" /></div>
            <div className="flex items-end"><Button className="btn btn-primary">+ New Template</Button></div>
          </form>
          {!templates ? (
            <Skeleton className="h-64 w-full" />
          ) : templates.length === 0 ? (
            <EmptyState title="No templates yet" />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Body</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <tbody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-md truncate">{t.body}</TableCell>
                      <TableCell><Badge className={t.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>{t.is_active ? "ACTIVE" : "INACTIVE"}</Badge></TableCell>
                      <TableCell className="text-right"><Button className="btn btn-outline btn-xs text-red-600" onClick={() => setConfirmDelete(t)}>Delete</Button></TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </TabsContent>
      </div>

      <ConfirmDialog open={!!confirmDelete} onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} title="Delete template?" message={`Delete template "${confirmDelete?.name}"?`} />
    </main>
  )
}

export default WhatsAppLogs