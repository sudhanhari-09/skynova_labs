export interface DateValidationResult {
  valid: boolean
  error?: string
}

export function validateDateString(
  value: string,
  opts?: { minYear?: number; maxYear?: number; futureOnly?: boolean; required?: boolean }
): DateValidationResult {
  const minYear = opts?.minYear ?? 1900
  const maxYear = opts?.maxYear ?? 2100
  const futureOnly = opts?.futureOnly ?? false
  const required = opts?.required ?? false

  const trimmed = value.trim()

  if (!trimmed) {
    if (required) return { valid: false, error: "This date is required." }
    return { valid: true }
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) {
    return { valid: false, error: "Please enter a valid date in YYYY-MM-DD format." }
  }

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)

  if (year < minYear || year > maxYear) {
    return { valid: false, error: `Please enter a date between ${minYear} and ${maxYear}.` }
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: "Please enter a valid date." }
  }
  if (day < 1 || day > 31) {
    return { valid: false, error: "Please enter a valid date." }
  }

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (isLeap) daysInMonth[1] = 29

  if (day > daysInMonth[month - 1]) {
    return { valid: false, error: "Please enter a valid date." }
  }

  const reconstructed = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  if (reconstructed !== trimmed) {
    return { valid: false, error: "Please enter a valid date." }
  }

  if (futureOnly) {
    const inputDate = new Date(Date.UTC(year, month - 1, day))
    const now = new Date()
    if (inputDate <= now) {
      return { valid: false, error: "Please enter a future date." }
    }
  }

  return { valid: true }
}

export function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatTime(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

/* ============================================================
   Calendar helpers (admin event calendar)

   Everything here works with local calendar days ("YYYY-MM-DD"
   keys) so a day cell only ever contains an event that really
   falls on that day, in the admin's own timezone.
   ============================================================ */

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const

/** A calendar year must always be written with exactly four digits. */
export const MIN_CALENDAR_YEAR = 1900
export const MAX_CALENDAR_YEAR = 2100

export interface CalendarCell {
  /** Local calendar day key, always `YYYY-MM-DD`. */
  key: string
  date: Date
  day: number
  /** False for the padded days that belong to the previous/next month. */
  inCurrentMonth: boolean
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Number of days in a 1-based month (1 = January), leap years included. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

/** Local `YYYY-MM-DD` key for a date. Never shifted by the UTC offset. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * Strictly parse a `YYYY-MM-DD` key into a local midnight Date.
 * Returns null for anything malformed or out of range (no silent rollover).
 */
export function parseDateKey(key: string, opts?: { minYear?: number; maxYear?: number }): Date | null {
  const result = validateDateString(key, {
    required: true,
    minYear: opts?.minYear ?? MIN_CALENDAR_YEAR,
    maxYear: opts?.maxYear ?? MAX_CALENDAR_YEAR,
  })
  if (!result.valid) return null

  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/** First day of a month as a local Date (monthIndex is 0-based). */
export function monthStart(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0)
}

/** Step a month view backwards/forwards, clamped to the supported years. */
export function shiftMonth(view: Date, delta: number): Date {
  const target = new Date(view.getFullYear(), view.getMonth() + delta, 1)
  const year = Math.min(MAX_CALENDAR_YEAR, Math.max(MIN_CALENDAR_YEAR, target.getFullYear()))
  return new Date(year, target.getMonth(), 1)
}

/** Move a date by whole days (local, DST-safe). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/**
 * Shift a date by whole months keeping the day where possible
 * (31 Jan + 1 month -> 28/29 Feb).
 */
export function shiftMonthKeepingDay(date: Date, delta: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const maxDay = daysInMonth(target.getFullYear(), target.getMonth() + 1)
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), maxDay))
}

/**
 * Build the day cells of a month grid. The grid always starts on a Sunday and
 * contains only whole weeks, so leading/trailing days from the neighbouring
 * months are included (and stay selectable) exactly like a real calendar.
 */
export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1)
  const leading = first.getDay()
  const monthDays = daysInMonth(year, monthIndex + 1)
  const weeks = Math.ceil((leading + monthDays) / 7)
  const totalCells = weeks * 7
  const gridStart = new Date(year, monthIndex, 1 - leading)

  const cells: CalendarCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    cells.push({
      key: toDateKey(date),
      date,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
    })
  }
  return cells
}

/** All local days an event covers (inclusive), capped to keep the grid cheap. */
export function expandEventDays(start: Date, end: Date | null, maxDays = 400): string[] {
  const days: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : cursor
  // A malformed/excessive range must never lock the UI.
  const span = Math.min(maxDays, Math.round((last.getTime() - cursor.getTime()) / 86400000) + 1)
  for (let i = 0; i < span; i++) {
    days.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** "September 2026" */
export function formatMonthYear(view: Date): string {
  return `${MONTH_NAMES[view.getMonth()]} ${view.getFullYear()}`
}

/** "Tuesday, 15 September 2026" — built from the validated date parts. */
export function formatReadableDate(key: string): string {
  const date = parseDateKey(key)
  if (!date) return "Invalid date"
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

/** "15 Sep 2026" — compact form used for multi-day event ranges. */
export function formatCompactDate(key: string): string {
  const date = parseDateKey(key)
  if (!date) return "Invalid date"
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`
}

/** Validate a 24-hour `HH:MM` (or `HH:MM:SS`) time string. */
export function validateTimeString(
  value: string,
  opts?: { required?: boolean }
): DateValidationResult {
  const required = opts?.required ?? false
  const trimmed = (value || "").trim()
  if (!trimmed) {
    if (required) return { valid: false, error: "This time is required." }
    return { valid: true }
  }
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (!match) {
    return { valid: false, error: "Please enter a valid time (HH:MM)." }
  }
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = match[3] ? parseInt(match[3], 10) : 0
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return { valid: false, error: "Please enter a valid time (HH:MM)." }
  }
  return { valid: true }
}

/**
 * Local, timezone-safe ISO string (`YYYY-MM-DDTHH:MM:SS`, no trailing `Z`).
 *
 * The calendar stores naive local timestamps (the `calendar_events` table uses
 * `timestamp without time zone`), so serialising with `toISOString()` would
 * shift an evening event onto the previous/next calendar day for admins in
 * non-UTC timezones.
 */
export function toLocalIsoString(date: Date): string {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  )
}

/**
 * Combine a validated `YYYY-MM-DD` day and an `HH:MM` time into a local ISO
 * string. Returns null when either part is malformed or the combination would
 * silently roll over (e.g. February 30), so malformed dates can never be sent.
 */
export function combineDateAndTime(dateKey: string, time: string): string | null {
  const dateCheck = validateDateString(dateKey, {
    required: true,
    minYear: MIN_CALENDAR_YEAR,
    maxYear: MAX_CALENDAR_YEAR,
  })
  if (!dateCheck.valid) return null

  const timeCheck = validateTimeString(time, { required: true })
  if (!timeCheck.valid) return null

  const [year, month, day] = dateKey.split("-").map(Number)
  const [hours, minutes] = time.split(":").map(Number)
  const combined = new Date(year, month - 1, day, hours, minutes, 0, 0)

  if (
    combined.getFullYear() !== year ||
    combined.getMonth() !== month - 1 ||
    combined.getDate() !== day ||
    combined.getHours() !== hours ||
    combined.getMinutes() !== minutes
  ) {
    return null
  }
  return toLocalIsoString(combined)
}

/** Local start-of-day ISO bound for a day key (used for API range queries). */
export function startOfDayIso(dateKey: string): string | null {
  return combineDateAndTime(dateKey, "00:00")
}

/** Local end-of-day ISO bound for a day key (used for API range queries). */
export function endOfDayIso(dateKey: string): string | null {
  return combineDateAndTime(dateKey, "23:59")
}

/** Parse an API datetime string, returning null instead of an Invalid Date. */
export function parseApiDateTime(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/** `HH:MM` from an API datetime, or "" when unparseable. */
export function toTimeInputValue(value?: string | null): string {
  const date = parseApiDateTime(value)
  if (!date) return ""
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "All day" for all-day events, otherwise the local time range. */
export function formatEventTimeRange(
  startsAt: string,
  endsAt?: string | null,
  allDay?: boolean
): string {
  if (allDay) return "All day"
  const start = formatTime(startsAt)
  if (!endsAt) return start
  return `${start} – ${formatTime(endsAt)}`
}

/** "10 Sep 2026" or "10 Sep 2026 – 12 Sep 2026" for multi-day events. */
export function formatEventDateRange(startsAt: string, endsAt?: string | null): string {
  const start = parseApiDateTime(startsAt)
  if (!start) return "Invalid date"
  const startLabel = formatCompactDate(toDateKey(start))
  const end = parseApiDateTime(endsAt)
  if (!end || toDateKey(end) === toDateKey(start)) return startLabel
  return `${startLabel} – ${formatCompactDate(toDateKey(end))}`
}
