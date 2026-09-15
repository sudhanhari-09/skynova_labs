export interface ValidationResult {
  valid: boolean
  error?: string
}

// ── Email ──────────────────────────────────────────────────────
export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: "Email is required." }
  if (trimmed.length > 254) return { valid: false, error: "Email must be 254 characters or fewer." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: "Please enter a valid email address." }
  return { valid: true }
}

// ── Phone / WhatsApp ───────────────────────────────────────────
export function validatePhone(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: "Phone number is required." }
  if (!/^[+]?[\d\s\-().]{7,20}$/.test(trimmed)) return { valid: false, error: "Please enter a valid phone number." }
  return { valid: true }
}

// ── Name ───────────────────────────────────────────────────────
export function validateName(value: string, maxLength = 150): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: "Name is required." }
  if (trimmed.length > maxLength) return { valid: false, error: `Name must be ${maxLength} characters or fewer.` }
  if (/^\d+$/.test(trimmed)) return { valid: false, error: "Please enter a valid name (not just numbers)." }
  return { valid: true }
}

// ── INR Budget ─────────────────────────────────────────────────
export function validateBudget(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  if (!/^[1-9]\d{0,10}$/.test(trimmed)) return { valid: false, error: "Please enter a valid budget amount in INR." }
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 1 || num > 99999999999) return { valid: false, error: "Please enter a valid budget amount in INR." }
  return { valid: true }
}

// ── Timeline (months) ──────────────────────────────────────────
export function validateTimeline(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  if (!/^[1-9]\d{0,2}$/.test(trimmed)) return { valid: false, error: "Please enter a valid timeline in months." }
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 1 || num > 120) return { valid: false, error: "Please enter a valid timeline in months." }
  return { valid: true }
}

// ── Positive Integer ───────────────────────────────────────────
export function validatePositiveInteger(value: string, min = 1, max = 999999): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  if (!/^[1-9]\d{0,6}$/.test(trimmed)) return { valid: false, error: "Please enter a valid whole number." }
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < min || num > max) return { valid: false, error: `Value must be between ${min} and ${max}.` }
  return { valid: true }
}

// ── Non-negative Number (for monetary fields) ──────────────────
export function validateNonNegativeNumber(value: string, max = 999999999): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { valid: false, error: "Please enter a valid amount." }
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0 || num > max) return { valid: false, error: "Please enter a valid amount." }
  return { valid: true }
}

// ── URL ────────────────────────────────────────────────────────
export function validateUrl(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  try {
    const url = new URL(trimmed)
    if (!["http:", "https:"].includes(url.protocol)) return { valid: false, error: "URL must use http or https." }
    return { valid: true }
  } catch {
    return { valid: false, error: "Please enter a valid URL." }
  }
}

// ── Slug ───────────────────────────────────────────────────────
export function validateSlug(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: "Slug is required." }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return { valid: false, error: "Slug must contain only lowercase letters, numbers, and hyphens." }
  if (trimmed.length > 200) return { valid: false, error: "Slug must be 200 characters or fewer." }
  return { valid: true }
}

// ── Whitespace-only rejection for optional text ────────────────
export function validateOptionalText(value: string, minLen = 1, maxLen = 5000): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true }
  if (trimmed.length < minLen) return { valid: false, error: "Value too short." }
  if (trimmed.length > maxLen) return { valid: false, error: `Value must be ${maxLen} characters or fewer.` }
  return { valid: true }
}

// ── Date string (YYYY-MM-DD) ───────────────────────────────────
export { validateDateString } from "./date"
