import React, { useCallback, useEffect, useState } from "react"
import { fetchCalendarEvents, createCalendarEvent, deleteCalendarEvent } from "../../services/api"
import { PageHeader, Skeleton, StateError, EmptyState, Button, Alert, StatusBadge } from "../../components/ui"

const Calendar: React.FC = () => {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: "", event_type: "MEETING", starts_at: "", ends_at: "", location: "", description: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const rangeStart = new Date(2020, 0, 1).toISOString()
      const rangeEnd = new Date(2100, 0, 1).toISOString()
      setEvents(await fetchCalendarEvents(rangeStart, rangeEnd))
    } catch (e: any) {
      setError(e.message || "Failed to load events")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.starts_at) return
    setSaving(true)
    setNotice("")
    try {
      await createCalendarEvent({
        title: form.title,
        event_type: form.event_type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        location: form.location || undefined,
        description: form.description || undefined,
      })
      setShowNew(false)
      setForm({ title: "", event_type: "MEETING", starts_at: "", ends_at: "", location: "", description: "" })
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to create event")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this event?")) return
    try {
      await deleteCalendarEvent(id)
      await load()
    } catch (e: any) {
      setNotice(e.message || "Failed to delete event")
    }
  }

  const groupByDate = (list: any[]) => {
    const map = new Map<string, any[]>()
    for (const ev of list) {
      const key = new Date(ev.starts_at).toLocaleDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return Array.from(map.entries()).sort((a, b) => new Date(a[1][0].starts_at).getTime() - new Date(b[1][0].starts_at).getTime())
  }

  return (
    <main>
      <PageHeader
        title="Team Calendar"
        subtitle={`${events.length} upcoming events`}
        actions={<Button onClick={() => setShowNew(!showNew)}>{showNew ? "Close" : "New event"}</Button>}
      />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <div className="mb-4"><Alert variant={notice.includes("Failed") ? "error" : "success"}>{notice}</Alert></div>}

      {showNew && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create event</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="label" htmlFor="ev-title">Title *</label>
              <input id="ev-title" className="input input-bordered w-full" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ev-type">Type</label>
              <select id="ev-type" className="input input-bordered w-full" value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
                <option value="MEETING">MEETING</option>
                <option value="CALL">CALL</option>
                <option value="DEADLINE">DEADLINE</option>
                <option value="MILESTONE">MILESTONE</option>
                <option value="FOLLOW_UP">FOLLOW_UP</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ev-loc">Location</label>
              <input id="ev-loc" className="input input-bordered w-full" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ev-start">Starts *</label>
              <input id="ev-start" type="datetime-local" className="input input-bordered w-full" value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ev-end">Ends</label>
              <input id="ev-end" type="datetime-local" className="input input-bordered w-full" value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.starts_at}>
            {saving ? "Creating…" : "Create event"}
          </Button>
        </div>
      )}

      {loading && <Skeleton className="h-6 w-full" rows={5} />}
      {!loading && error && <StateError message={error} onRetry={load} />}
      {!loading && !error && events.length === 0 && <EmptyState title="No events" description="Create an event to schedule meetings and deadlines." />}
      {!loading && !error && events.length > 0 && (
        <div className="space-y-4">
          {groupByDate(events).map(([date, dayEvents]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{date}</h3>
              <div className="space-y-2">
                {dayEvents.map((ev: any) => (
                  <div key={ev.id} className="card flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={ev.event_type} />
                        <span className="text-sm font-semibold text-gray-900">{ev.title}</span>
                      </div>
                      {ev.location && <p className="text-xs text-gray-500 mt-1">📍 {ev.location}</p>}
                      {ev.description && <p className="text-sm text-gray-600 mt-1">{ev.description}</p>}
                    </div>
                    <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                      <div>{new Date(ev.starts_at).toLocaleTimeString()}</div>
                      {ev.ends_at && <div>→ {new Date(ev.ends_at).toLocaleTimeString()}</div>}
                      <button type="button" className="btn-link text-red-600 mt-1" onClick={() => handleDelete(ev.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default Calendar