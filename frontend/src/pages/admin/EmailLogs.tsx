import React, { useCallback, useEffect, useState } from "react"
import {
  fetchEmailLogs,
  fetchEmailTemplates,
  createEmailTemplate,
  deleteEmailTemplate,
  EmailLog,
  EmailTemplate,
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

const EmailLogs: React.FC = () => {
  const run = useToastAction()
  const [logs, setLogs] = useState<EmailLog[] | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null)
  const [tab, setTab] = useState("logs")
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState({ name: "", subject: "", body_text: "" })

  const load = useCallback(() => {
    return Promise.all([
      fetchEmailLogs(150).catch(() => []),
      fetchEmailTemplates().catch(() => []),
    ]).then(([l, t]) => {
      setLogs(l)
      setTemplates(t)
      return true
    })
  }, [])

  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.subject.trim()) return
    run(async () => {
      await createEmailTemplate({ name: form.name.trim(), subject: form.subject.trim(), body_text: form.body_text.trim() })
      setForm({ name: "", subject: "", body_text: "" })
      await load()
    }, { success: "Template created" })
  }

  const doDelete = () => {
    if (!confirmDelete) return
    run(async () => {
      await deleteEmailTemplate(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    }, { success: "Template deleted" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Email Logs" subtitle="Audit trail of outbound email communications." />

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
            <EmptyState title="No email activity yet" description="Send an email (e.g. via the quotation or invoice flows) to see logs here. Delivery is simulated until an SMTP provider is configured." />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Related</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-gray-500">{fmtTime(l.email_timestamp)}</TableCell>
                      <TableCell className="text-sm">{l.recipient}</TableCell>
                      <TableCell className="text-sm text-gray-700">{l.subject || "—"}</TableCell>
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
            <div><Label>Name *</Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} placeholder="Welcome email" /></div>
            <div><Label>Subject *</Label><Input value={form.subject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Body text</Label><Input value={form.body_text} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, body_text: e.target.value })} /></div>
            <div className="sm:col-span-3"><Button className="btn btn-primary">+ New Template</Button></div>
          </form>
          {!templates ? (
            <Skeleton className="h-64 w-full" />
          ) : templates.length === 0 ? (
            <EmptyState title="No templates yet" />
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <tbody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-xs text-gray-500">{t.slug}</TableCell>
                      <TableCell className="text-sm">{t.subject}</TableCell>
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

export default EmailLogs