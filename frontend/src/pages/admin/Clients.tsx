import React, { useCallback, useEffect, useState } from "react"
import {
  fetchClients,
  createClient,
  updateClient,
  deleteClient,
  addClientCommunication,
  fetchClientCommunications,
  Client,
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

const statusTone = (status?: string) => {
  switch (status) {
    case "ACTIVE": return "bg-green-100 text-green-800"
    case "INACTIVE": return "bg-gray-100 text-gray-600"
    case "LEAD": return "bg-amber-100 text-amber-800"
    default: return "bg-blue-100 text-blue-800"
  }
}

const Clients: React.FC = () => {
  const run = useToastAction()
  const [clients, setClients] = useState<Client[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null)
  const [commClient, setCommClient] = useState<Client | null>(null)
  const [commText, setCommText] = useState("")
  const [commHistory, setCommHistory] = useState<Record<string, unknown>[]>([])

  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", status: "ACTIVE" })

  const load = useCallback(() => {
    fetchClients(search || undefined, statusFilter || undefined).then(setClients).catch((e) => setError(e.message))
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    if (!form.phone.trim()) return
    run(async () => {
      await createClient(form)
      setForm({ name: "", company: "", email: "", phone: "", status: "ACTIVE" })
      await load()
    }, { success: "Client created" })
  }

  const toggleStatus = (c: Client) => {
    run(async () => {
      await updateClient(c.id, { status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
      await load()
    }, { success: "Status updated" })
  }

  const doDelete = () => {
    if (!confirmDelete) return
    run(async () => {
      await deleteClient(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    }, { success: "Client deleted" })
  }

  const openComms = async (c: Client) => {
    try {
      const history = await fetchClientCommunications(c.id)
      setCommHistory(history)
    } catch {
      setCommHistory([])
    }
    setCommClient(c)
    setCommText("")
  }

  const addComm = () => {
    if (!commClient || !commText.trim()) return
    run(async () => {
      const history = await addClientCommunication(commClient.id, { type: "note", content: commText.trim() })
      setCommHistory(history)
      setCommText("")
    }, { success: "Communication added" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Clients" subtitle="Companies and organisations we work with." />

        {error && <StateError message={error} onRetry={load} />}

        <form onSubmit={submit} className="bg-white rounded-lg shadow p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" /></div>
          <div><Label>Company</Label><Input value={form.company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label required>Phone</Label><Input value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Status</Label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
              <option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="LEAD">LEAD</option>
            </select>
          </div>
          <div className="flex items-end"><Button className="btn btn-primary w-full">+ Add Client</Button></div>
        </form>

        <div className="flex flex-wrap gap-3 mb-4">
          <Input className="max-w-xs" placeholder="Search name / company / email" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-gray-300 px-2 text-sm">
            <option value="">All statuses</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="LEAD">LEAD</option>
          </select>
          <Button className="btn btn-outline" onClick={load}>Refresh</Button>
        </div>

        {!clients ? (
          <Skeleton className="h-64 w-full" />
        ) : clients.length === 0 ? (
          <EmptyState title="No clients found" />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{c.company || "—"}</TableCell>
                    <TableCell className="text-sm">{c.email || c.phone || "—"}</TableCell>
                    <TableCell><Badge className={statusTone(c.status)}>{c.status}</Badge></TableCell>
                    <TableCell className="text-sm">{c.projects_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {c.quotations_count ?? 0}Q · {c.contracts_count ?? 0}C · {c.invoices_count ?? 0}I
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button className="btn btn-outline btn-xs" onClick={() => openComms(c)}>Comms</Button>
                        <Button className="btn btn-outline btn-xs" onClick={() => toggleStatus(c)}>{c.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>
                        <Button className="btn btn-outline btn-xs text-red-600" onClick={() => setConfirmDelete(c)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {commClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5">
            <div className="font-semibold text-gray-900 mb-3">Communications — {commClient.name}</div>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-3">
              {commHistory.length === 0 && <p className="text-sm text-gray-500">No communications yet.</p>}
              {commHistory.map((h, i) => (
                <div key={i} className="rounded bg-gray-50 border border-gray-100 p-3 text-sm">
                  <div className="text-xs text-gray-400">{String(h.timestamp || "")} · {String(h.type || "note")} · by #{String(h.user_id ?? "—")}</div>
                  <div className="text-gray-800">{String(h.content || "")}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={commText} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCommText(e.target.value)} placeholder="Add a note…" />
              <Button className="btn btn-primary" onClick={addComm}>Add</Button>
            </div>
            <div className="mt-4 text-right"><Button className="btn btn-outline" onClick={() => setCommClient(null)}>Close</Button></div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirmDelete} onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} title="Delete client?" message={`Delete ${confirmDelete?.name}? This removes the client record.`} />
    </main>
  )
}

export default Clients