import React, { useCallback, useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getSupportTicket, updateSupportTicket, addSupportMessage } from "../../services/api"
import { PageHeader, Skeleton, StateError, StatusBadge, Button, Alert, EmptyState } from "../../components/ui"

const SupportTicketDetails: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>()
  const id = Number(ticketId)
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [message, setMessage] = useState("")
  const [isInternal, setIsInternal] = useState(true)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setTicket(await getSupportTicket(id))
    } catch (e: any) {
      setError(e.message || "Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleStatus = async (status: string) => {
    try {
      setTicket(await updateSupportTicket(id, { status }))
    } catch (e: any) {
      setNotice(e.message || "Failed to update status")
    }
  }

  const handleMessage = async () => {
    if (!message.trim()) return
    setSending(true)
    setNotice("")
    try {
      await addSupportMessage(id, { content: message.trim(), is_internal: isInternal })
      setMessage("")
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to send message")
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="py-6"><Skeleton className="h-6 w-64" /><div className="mt-6"><Skeleton className="h-64 w-full" /></div></div>
  if (error) return <StateError message={error} onRetry={load} />
  if (!ticket) return <EmptyState title="Ticket not found" />

  return (
    <main>
      <PageHeader
        title={`${ticket.ticket_number} · ${ticket.subject}`}
        subtitle={`Created ${new Date(ticket.created_at).toLocaleString()}`}
        actions={
          <>
            <Link to="/admin/support" className="btn-secondary">Back</Link>
            <select
              className="input input-bordered w-40"
              value={ticket.status}
              onChange={(e) => handleStatus(e.target.value)}
            >
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="WAITING">WAITING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </>
        }
      />

      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      <div className="card mb-6">
        <dl className="def-list">
          <div><dt>Status</dt><dd><StatusBadge status={ticket.status} /></dd></div>
          <div><dt>Priority</dt><dd><StatusBadge status={ticket.priority} /></dd></div>
          <div><dt>Category</dt><dd>{ticket.category || "—"}</dd></div>
          <div><dt>Contact</dt><dd>{ticket.contact_email || ticket.contact_name || "—"}</dd></div>
          <div><dt>Assignee</dt><dd>{ticket.assignee_id ? `User #${ticket.assignee_id}` : "Unassigned"}</dd></div>
          <div><dt>Project</dt><dd>{ticket.project_id ? `#${ticket.project_id}` : "—"}</dd></div>
        </dl>
        {ticket.description && <p className="text-sm text-gray-700 mt-4">{ticket.description}</p>}
      </div>

      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Conversation</h3>
        {ticket.messages.length === 0 && <p className="text-sm text-gray-500">No messages yet.</p>}
        <div className="space-y-4">
          {ticket.messages.map((m: any) => (
            <div key={m.id} className={`p-3 rounded-md border ${m.is_internal ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">{m.author_name || `User #${m.author_id}`}</span>
                <span className="text-xs text-gray-500">{m.is_internal ? "Internal note" : "To client"} · {new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700">{m.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={isInternal} onChange={() => setIsInternal(true)} /> Internal note
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" checked={!isInternal} onChange={() => setIsInternal(false)} /> Client-visible
            </label>
          </div>
          <div className="flex items-start gap-3">
            <textarea
              className="input input-bordered w-full"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a reply…"
            />
            <Button onClick={handleMessage} disabled={sending || !message.trim()}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default SupportTicketDetails