import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "../../services/api"
import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  StateError,
  StatusBadge,
  Textarea,
} from "../../components/ui"
import MonthCalendar, { type CalendarDayEvents } from "../../components/MonthCalendar"
import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  buildMonthGrid,
  combineDateAndTime,
  daysInMonth,
  endOfDayIso,
  expandEventDays,
  formatEventDateRange,
  formatEventTimeRange,
  formatMonthYear,
  formatReadableDate,
  monthStart,
  parseApiDateTime,
  parseDateKey,
  startOfDayIso,
  toDateKey,
  toTimeInputValue,
  validateDateString,
  validateTimeString,
} from "../../utils/date"

/**
 * Admin event calendar.
 *
 * A large month grid (see `components/MonthCalendar`) plus a day panel that
 * lists, creates, edits and deletes the events of the selected date. Every
 * event is read from and written to the existing `/admin/calendar` API — no
 * mock or frontend-only persistence — and dates are validated strictly on both
 * the client and the server.
 */

const EVENT_TYPES = ["MEETING", "CALL", "DEADLINE", "MILESTONE", "FOLLOW_UP", "OTHER"]

interface EventFormState {
  title: string
  event_type: string
  all_day: boolean
  date: string
  start_time: string
  end_time: string
  location: string
  description: string
}

const emptyForm = (dateKey: string): EventFormState => ({
  title: "",
  event_type: "MEETING",
  all_day: false,
  date: dateKey,
  start_time: "09:00",
  end_time: "10:00",
  location: "",
  description: "",
})

const monthKeyOf = (view: Date): string =>
  `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`

const LOAD_ERROR_MESSAGE = "Unable to load calendar events. Please try again."

const Calendar: React.FC = () => {
  const [todayKey] = useState(() => toDateKey(new Date()))
  const [view, setView] = useState<Date>(() => {
    const now = new Date()
    return monthStart(now.getFullYear(), now.getMonth())
  })
  const [selectedKey, setSelectedKey] = useState<string>(() => toDateKey(new Date()))

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(() => emptyForm(todayKey))
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState(false)

  // One cached fetch per displayed month, cleared after every write so the
  // grid always reflects the database without re-requesting the same month.
  const cacheRef = useRef<Map<string, CalendarEvent[]>>(new Map())
  const requestIdRef = useRef(0)

  const loadMonth = useCallback(async (viewDate: Date, force = false) => {
    const cacheKey = monthKeyOf(viewDate)
    if (!force) {
      const cached = cacheRef.current.get(cacheKey)
      if (cached) {
        setEvents(cached)
        setLoadError("")
        setLoading(false)
        setInitialLoading(false)
        return
      }
    }

    const cells = buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth())
    const rangeStart = startOfDayIso(cells[0].key)
    const rangeEnd = endOfDayIso(cells[cells.length - 1].key)
    if (!rangeStart || !rangeEnd) {
      setLoadError(LOAD_ERROR_MESSAGE)
      setLoading(false)
      setInitialLoading(false)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setLoadError("")

    try {
      const data = await fetchCalendarEvents(rangeStart, rangeEnd)
      const list = Array.isArray(data) ? data : []
      cacheRef.current.set(cacheKey, list)
      if (requestIdRef.current === requestId) setEvents(list)
    } catch (e: any) {
      if (requestIdRef.current === requestId) {
        setEvents([])
        setLoadError(e?.message || LOAD_ERROR_MESSAGE)
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false)
        setInitialLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadMonth(view)
  }, [loadMonth, view])

  /* ---------- derived data ---------- */

  const markers = useMemo<Record<string, CalendarDayEvents>>(() => {
    const map: Record<string, CalendarDayEvents> = {}
    const gridKeys = new Set(
      buildMonthGrid(view.getFullYear(), view.getMonth()).map((cell) => cell.key)
    )
    for (const event of events) {
      const start = parseApiDateTime(event.starts_at)
      if (!start) continue
      const end = parseApiDateTime(event.ends_at)
      for (const dayKey of expandEventDays(start, end)) {
        if (!gridKeys.has(dayKey)) continue
        const entry = map[dayKey] || { count: 0, titles: [] }
        entry.count += 1
        entry.titles.push(event.title)
        map[dayKey] = entry
      }
    }
    return map
  }, [events, view])

  const selectedEvents = useMemo(
    () =>
      events.filter((event) => {
        const start = parseApiDateTime(event.starts_at)
        if (!start) return false
        return expandEventDays(start, parseApiDateTime(event.ends_at)).includes(selectedKey)
      }),
    [events, selectedKey]
  )

  const monthEventCount = useMemo(
    () =>
      events.filter((event) => {
        const start = parseApiDateTime(event.starts_at)
        if (!start) return false
        return start.getMonth() === view.getMonth() && start.getFullYear() === view.getFullYear()
      }).length,
    [events, view]
  )

  /* ---------- navigation ---------- */

  /**
   * Change the displayed month. When the selected day is not part of the new
   * grid the selection follows the month (same day-of-month where possible) so
   * the day panel always matches the loaded month data.
   */
  const changeView = (nextView: Date) => {
    const cells = buildMonthGrid(nextView.getFullYear(), nextView.getMonth())
    if (!cells.some((cell) => cell.key === selectedKey)) {
      const current = parseDateKey(selectedKey)
      const maxDay = daysInMonth(nextView.getFullYear(), nextView.getMonth() + 1)
      const day = Math.min(current ? current.getDate() : 1, maxDay)
      const candidate = toDateKey(new Date(nextView.getFullYear(), nextView.getMonth(), day))
      setSelectedKey(cells.some((cell) => cell.key === candidate) ? candidate : cells[0].key)
    }
    setView(monthStart(nextView.getFullYear(), nextView.getMonth()))
  }

  const selectDate = (key: string) => {
    setSelectedKey(key)
    setActionError("")
    // Keep the date field of an open form in sync with the calendar.
    if (formOpen) setForm((prev) => ({ ...prev, date: key }))
  }

  const goToToday = () => {
    const now = new Date()
    setView(monthStart(now.getFullYear(), now.getMonth()))
    setSelectedKey(todayKey)
  }

  const retryLoad = () => {
    cacheRef.current.delete(monthKeyOf(view))
    loadMonth(view, true)
  }

  /* ---------- form ---------- */

  const openCreateForm = () => {
    setEditing(null)
    setForm(emptyForm(selectedKey))
    setFormError("")
    setActionError("")
    setNotice("")
    setFormOpen(true)
  }

  const openEditForm = (event: CalendarEvent) => {
    const start = parseApiDateTime(event.starts_at)
    setEditing(event)
    setForm({
      title: event.title,
      event_type: event.event_type || "MEETING",
      all_day: !!event.all_day,
      date: start ? toDateKey(start) : selectedKey,
      start_time: toTimeInputValue(event.starts_at) || "09:00",
      end_time: toTimeInputValue(event.ends_at),
      location: event.location || "",
      description: event.description || "",
    })
    setFormError("")
    setActionError("")
    setNotice("")
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setNotice("")

    if (!form.title.trim()) {
      setFormError("Please enter an event title.")
      return
    }

    const dateCheck = validateDateString(form.date, {
      required: true,
      minYear: MIN_CALENDAR_YEAR,
      maxYear: MAX_CALENDAR_YEAR,
    })
    if (!dateCheck.valid) {
      setFormError(dateCheck.error || "Please enter a valid calendar date.")
      return
    }

    let startsAt: string | null
    let endsAt: string | null = null

    if (form.all_day) {
      startsAt = combineDateAndTime(form.date, "00:00")
    } else {
      const startTimeCheck = validateTimeString(form.start_time, { required: true })
      if (!startTimeCheck.valid) {
        setFormError(startTimeCheck.error || "Please enter a valid time (HH:MM).")
        return
      }
      startsAt = combineDateAndTime(form.date, form.start_time)
      if (form.end_time.trim()) {
        const endTimeCheck = validateTimeString(form.end_time)
        if (!endTimeCheck.valid) {
          setFormError(endTimeCheck.error || "Please enter a valid time (HH:MM).")
          return
        }
        endsAt = combineDateAndTime(form.date, form.end_time)
        if (endsAt && startsAt && endsAt < startsAt) {
          setFormError("The end time must be after the start time.")
          return
        }
      }
    }

    if (!startsAt) {
      setFormError("Please enter a valid calendar date.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        event_type: form.event_type,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: form.all_day,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
      }
      if (editing) {
        await updateCalendarEvent(editing.id, payload as Partial<CalendarEvent>)
      } else {
        await createCalendarEvent(payload as Partial<CalendarEvent>)
      }

      cacheRef.current.clear()
      const savedDate = parseDateKey(form.date) || new Date()
      const savedView = monthStart(savedDate.getFullYear(), savedDate.getMonth())
      setView(savedView)
      setSelectedKey(form.date)
      setNotice(editing ? "Event updated." : "Event saved.")
      setFormOpen(false)
      setEditing(null)
      await loadMonth(savedView, true)
    } catch (err: any) {
      // Never surface a raw backend payload to the admin.
      const detail: string = err?.message || ""
      setFormError(
        detail && !/^\s*\{/.test(detail)
          ? `Unable to save this event. ${detail}`
          : "Unable to save this event."
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setActionError("")
    try {
      await deleteCalendarEvent(pendingDelete.id)
      cacheRef.current.clear()
      setNotice("Event deleted.")
      setPendingDelete(null)
      await loadMonth(view, true)
    } catch (err: any) {
      const detail: string = err?.message || ""
      setActionError(detail ? `Unable to delete this event. ${detail}` : "Unable to delete this event.")
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const selectedLabel = formatReadableDate(selectedKey)

  if (initialLoading) {
    return (
      <main>
        <PageHeader title="Team Calendar" subtitle="Loading events…" />
        <PageSkeleton title="Loading calendar" />
      </main>
    )
  }
  const eventForm = (
    <form className="calendar-form" onSubmit={handleSubmit} noValidate>
      <div className="flex items-center justify-between gap-2">
        <h3 className="calendar-form__title">{editing ? "Edit event" : "Add event"}</h3>
        <span className="text-xs text-gray-500">{selectedLabel}</span>
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <div>
        <label className="label" htmlFor="cal-title">
          Title *
        </label>
        <Input
          id="cal-title"
          value={form.title}
          maxLength={200}
          required
          placeholder="e.g. Research review"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
        />
      </div>

      <div className="calendar-form__grid">
        <div>
          <label className="label" htmlFor="cal-type">
            Event type
          </label>
          <Select
            id="cal-type"
            value={form.event_type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setForm((prev) => ({ ...prev, event_type: e.target.value }))
            }
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="label" htmlFor="cal-location">
            Location
          </label>
          <Input
            id="cal-location"
            value={form.location}
            placeholder="Optional"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, location: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="cal-date">
            Date (YYYY-MM-DD) *
          </label>
          <Input
            id="cal-date"
            type="date"
            value={form.date}
            required
            min={`${MIN_CALENDAR_YEAR}-01-01`}
            max={`${MAX_CALENDAR_YEAR}-12-31`}
            aria-describedby="cal-date-hint"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, date: e.target.value }))
            }
          />
          <span id="cal-date-hint" className="text-xs text-gray-500">
            Picking a day on the calendar fills this field.
          </span>
        </div>

        <div>
          <label className="label" htmlFor="cal-start">
            Start time
          </label>
          <Input
            id="cal-start"
            type="time"
            value={form.start_time}
            disabled={form.all_day}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, start_time: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="cal-end">
            End time
          </label>
          <Input
            id="cal-end"
            type="time"
            value={form.end_time}
            disabled={form.all_day}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, end_time: e.target.value }))
            }
          />
        </div>

        <div className="flex items-end">
          <label className="calendar-form__checkbox" htmlFor="cal-allday">
            <input
              id="cal-allday"
              type="checkbox"
              checked={form.all_day}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, all_day: e.target.checked }))
              }
            />
            All-day event
          </label>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="cal-description">
          Description
        </label>
        <Textarea
          id="cal-description"
          rows={3}
          value={form.description}
          placeholder="Optional"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
        />
      </div>

      <div className="calendar-form__actions">
        <Button type="submit" loading={saving}>
          {editing ? "Save changes" : "Create event"}
        </Button>
        <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
          Cancel
        </Button>
        <span className="text-xs text-gray-500">Saved to the shared team calendar.</span>
      </div>
    </form>
  )
return (
    <main>
      <PageHeader
        title="Team Calendar"
        subtitle={`${monthEventCount} event${monthEventCount === 1 ? "" : "s"} in ${formatMonthYear(view)} · ${
          selectedEvents.length === 1 ? "1 event" : `${selectedEvents.length} events`
        } on ${selectedLabel}`}
        actions={<Button onClick={openCreateForm}>New event</Button>}
      />

      {notice && (
        <div className="mb-4">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <Alert variant="error">{actionError}</Alert>
        </div>
      )}

      <div className="calendar-page__layout">
        <MonthCalendar
          view={view}
          selectedKey={selectedKey}
          todayKey={todayKey}
          markers={markers}
          loading={loading}
          onSelectDate={selectDate}
          onChangeView={changeView}
          onToday={goToToday}
        />

        <section className="card calendar-panel" aria-label={`Events on ${selectedLabel}`}>
          <header className="calendar-panel__header">
            <div>
              <h3 className="calendar-panel__date">{selectedLabel}</h3>
              <p className="text-xs text-gray-500 mt-1">Selected date</p>
            </div>
            <span className="calendar-panel__count">
              {selectedEvents.length === 1 ? "1 event" : `${selectedEvents.length} events`}
            </span>
          </header>

          {loadError && (
            <StateError
              message={`${LOAD_ERROR_MESSAGE}${loadError && loadError !== LOAD_ERROR_MESSAGE ? ` (${loadError})` : ""}`}
              onRetry={retryLoad}
            />
          )}

          {!loadError && formOpen && eventForm}

          {!loadError && !formOpen && (
            <>
              {selectedEvents.length === 0 ? (
                <div className="calendar-panel__empty">
                  No events on this date. Use &ldquo;New event&rdquo; to schedule one.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((event) => (
                    <article className="calendar-event" key={event.id}>
                      <div className="calendar-event__top">
                        <StatusBadge status={event.event_type} />
                        <span className="calendar-event__title">{event.title}</span>
                      </div>
                      <p className="calendar-event__meta">
                        {formatEventTimeRange(event.starts_at, event.ends_at, event.all_day)} ·{" "}
                        {formatEventDateRange(event.starts_at, event.ends_at)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                      {event.description && (
                        <p className="calendar-event__description">{event.description}</p>
                      )}
                      <div className="calendar-event__actions">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => openEditForm(event)}
                          aria-label={`Edit event ${event.title}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link text-red-600"
                          onClick={() => {
                            setActionError("")
                            setPendingDelete(event)
                          }}
                          aria-label={`Delete event ${event.title}`}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <Button onClick={openCreateForm}>Add event on this date</Button>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete event?"
        message={`"${pendingDelete?.title ?? ""}" will be permanently removed from the calendar.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}

export default Calendar