import React, { useEffect, useRef, useState } from "react"
import {
  MAX_CALENDAR_YEAR,
  MIN_CALENDAR_YEAR,
  MONTH_NAMES,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
  addDays,
  buildMonthGrid,
  formatMonthYear,
  monthStart,
  parseDateKey,
  shiftMonth,
  shiftMonthKeepingDay,
  toDateKey,
} from "../utils/date"

/**
 * A real month calendar grid for the admin event calendar.
 *
 * Renders a large, clickable month view with previous / next / today controls,
 * weekday headers and one cell per day. Days that contain events carry a
 * visible marker (dot + event count + titles), so an admin never has to open a
 * date to discover whether it holds an event.
 *
 * Keyboard: arrow keys move by day/week, Home/End jump to the start/end of the
 * week and PageUp/PageDown move by month.
 */

export interface CalendarDayEvents {
  count: number
  titles: string[]
}

export interface MonthCalendarProps {
  /** Any date inside the month currently displayed. */
  view: Date
  /** Selected local day key (`YYYY-MM-DD`). */
  selectedKey: string
  /** Today's local day key (injected so the grid stays deterministic). */
  todayKey: string
  /** Event summary for each day key. */
  markers?: Record<string, CalendarDayEvents>
  loading?: boolean
  /** Shown inside the calendar when events could not be loaded. */
  error?: string | null
  onSelectDate: (key: string) => void
  onChangeView: (view: Date) => void
  onToday: () => void
  onRetry?: () => void
}

const MonthCalendar: React.FC<MonthCalendarProps> = ({
  view,
  selectedKey,
  todayKey,
  markers,
  loading = false,
  error = null,
  onSelectDate,
  onChangeView,
  onToday,
  onRetry,
}) => {
  const gridRef = useRef<HTMLDivElement>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const year = view.getFullYear()
  const monthIndex = view.getMonth()
  const cells = buildMonthGrid(year, monthIndex)

  // Keep exactly one cell in the tab order (roving tabindex).
  const tabbableKey = cells.some((cell) => cell.key === selectedKey)
    ? selectedKey
    : cells.find((cell) => cell.key === todayKey)?.key ?? cells[0].key

  // Focus a cell that was reached via the keyboard, including when the month
  // view was re-rendered after crossing a month boundary.
  useEffect(() => {
    if (!focusKey) return
    const target = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)
    if (target) {
      target.focus()
      setFocusKey(null)
    }
  }, [focusKey, view, cells])

  const selectAndFocus = (date: Date) => {
    const key = toDateKey(date)
    if (date.getMonth() !== monthIndex || date.getFullYear() !== year) {
      onChangeView(monthStart(date.getFullYear(), date.getMonth()))
    }
    onSelectDate(key)
    setFocusKey(key)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const currentKey = target.getAttribute("data-date")
    if (!currentKey) return

    const current = parseDateKey(currentKey)
    if (!current) return

    let next: Date | null = null
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(current, -1)
        break
      case "ArrowRight":
        next = addDays(current, 1)
        break
      case "ArrowUp":
        next = addDays(current, -7)
        break
      case "ArrowDown":
        next = addDays(current, 7)
        break
      case "Home":
        next = addDays(current, -current.getDay())
        break
      case "End":
        next = addDays(current, 6 - current.getDay())
        break
      case "PageUp":
        next = shiftMonthKeepingDay(current, -1)
        break
      case "PageDown":
        next = shiftMonthKeepingDay(current, 1)
        break
      default:
        return
    }

    event.preventDefault()
    if (next.getFullYear() < MIN_CALENDAR_YEAR || next.getFullYear() > MAX_CALENDAR_YEAR) return
    selectAndFocus(next)
  }

  const yearOptions: number[] = []
  for (let y = MIN_CALENDAR_YEAR; y <= MAX_CALENDAR_YEAR; y++) yearOptions.push(y)

  const monthLabel = formatMonthYear(view)

  return (
    <section className="calendar" aria-label="Event calendar">
      <div className="calendar__toolbar">
        <div className="calendar__heading">
          <h3 className="calendar__title" aria-live="polite">
            {monthLabel}
          </h3>
          <p className="calendar__subtitle">
            <span className="calendar__legend">
              <span className="calendar__legend-item">
                <span className="calendar__legend-swatch calendar__legend-swatch--today" aria-hidden="true" /> Today
              </span>
              <span className="calendar__legend-item">
                <span className="calendar__legend-swatch calendar__legend-swatch--selected" aria-hidden="true" /> Selected
              </span>
              <span className="calendar__legend-item">
                <span className="calendar__legend-swatch calendar__legend-swatch--event" aria-hidden="true" /> Has events
              </span>
            </span>
          </p>
        </div>

        <div className="calendar__controls">
          <button
            type="button"
            className="calendar__nav"
            onClick={() => onChangeView(shiftMonth(view, -1))}
            aria-label={`Show previous month (${formatMonthYear(shiftMonth(view, -1))})`}
          >
            <span aria-hidden="true">‹</span> Previous
          </button>
          <button
            type="button"
            className="calendar__nav calendar__nav--today"
            onClick={onToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            className="calendar__nav"
            onClick={() => onChangeView(shiftMonth(view, 1))}
            aria-label={`Show next month (${formatMonthYear(shiftMonth(view, 1))})`}
          >
            Next <span aria-hidden="true">›</span>
          </button>

          <span className="calendar__select">
            <select
              value={monthIndex}
              onChange={(e) => onChangeView(monthStart(year, Number(e.target.value)))}
              aria-label="Select month"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </span>

          <span className="calendar__select">
            <select
              value={year}
              onChange={(e) => onChangeView(monthStart(Number(e.target.value), monthIndex))}
              aria-label="Select year"
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </span>
        </div>
      </div>

      {loading && (
        <p className="calendar__status" role="status">
          <span className="spinner spinner--sm" aria-hidden="true" /> Loading events…
        </p>
      )}
      {!loading && error && (
        <p className="calendar__status calendar__status--error" role="alert">
          {error}{" "}
          {onRetry && (
            <button type="button" className="btn-link" onClick={onRetry}>
              Try again
            </button>
          )}
        </p>
      )}
<div
        ref={gridRef}
        className={`calendar__grid${loading ? " calendar__grid--loading" : ""}`}
        role="group"
        aria-label={`${monthLabel} calendar`}
        aria-busy={loading || undefined}
        onKeyDown={handleKeyDown}
      >
        <div className="calendar__row calendar__row--head">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className="calendar__weekday"
              role="columnheader"
              aria-label={WEEKDAY_NAMES[index]}
            >
              {label}
            </div>
          ))}
        </div>

        {Array.from({ length: cells.length / 7 }).map((_, weekIndex) => (
          <div className="calendar__row" key={`week-${weekIndex}`}>
            {cells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
              const isSelected = cell.key === selectedKey
              const isToday = cell.key === todayKey
              const summary = markers?.[cell.key]
              const eventCount = summary?.count ?? 0
              const classNames = [
                "calendar__cell",
                cell.inCurrentMonth ? "" : "calendar__cell--outside",
                isToday ? "calendar__cell--today" : "",
                isSelected ? "calendar__cell--selected" : "",
                eventCount > 0 ? "calendar__cell--events" : "",
              ]
                .filter(Boolean)
                .join(" ")

              const label = [
                `${WEEKDAY_NAMES[cell.date.getDay()]}, ${cell.day} ${MONTH_NAMES[cell.date.getMonth()]} ${cell.date.getFullYear()}`,
                isToday ? "today" : null,
                isSelected ? "selected" : null,
                eventCount === 0 ? "no events" : eventCount === 1 ? "1 event" : `${eventCount} events`,
              ]
                .filter(Boolean)
                .join(", ")

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={classNames}
                  data-date={cell.key}
                  onClick={() => onSelectDate(cell.key)}
                  tabIndex={cell.key === tabbableKey ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={label}
                >
                  <span className="calendar__daynum">{cell.day}</span>
                  {eventCount > 0 && summary && (
                    <span className="calendar__events">
                      <span className="calendar__event-count">
                        <span className="calendar__dot" aria-hidden="true" />
                        {eventCount === 1 ? "1 event" : `${eventCount} events`}
                      </span>
                      <span className="calendar__event-titles" aria-hidden="true">
                        {summary.titles.slice(0, 2).map((title, index) => (
                          <span className="calendar__event-title" key={`${title}-${index}`}>
                            {title}
                          </span>
                        ))}
                        {eventCount > 2 && (
                          <span className="calendar__event-title calendar__event-title--more">
                            +{eventCount - 2} more
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}

export default MonthCalendar