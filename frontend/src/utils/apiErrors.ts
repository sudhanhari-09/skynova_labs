/**
 * Centralized API error normalization.
 *
 * Every API error in the application flows through this module.
 * It converts raw backend responses into a predictable structure
 * that UI components can safely render.
 */

export interface NormalizedApiError {
  /** Human-readable error message (never raw JSON) */
  message: string
  /** Field-level errors keyed by frontend field name (e.g. "detailedRequirements") */
  fieldErrors?: Record<string, string>
  /** HTTP status code if available */
  status?: number
}

/**
 * Backend field names → frontend field names.
 * Add new mappings here as they are discovered.
 */
const FIELD_MAP: Record<string, string> = {
  // Quote request / contact form fields
  name: "name",
  email: "email",
  phone: "phone",
  whatsapp: "whatsapp",
  company_name: "companyName",
  designation: "designation",
  budget: "budget",
  timeline: "timeline",
  expected_launch: "expectedLaunch",
  detailed_requirements: "detailedRequirements",
  target_audience: "targetAudience",
  existing_system: "existingSystem",
  project_type_name: "projectTypeName",
  subcategory_name: "subcategoryName",
  project_type_slug: "projectTypeSlug",
  subcategory_slug: "subcategorySlug",

  // Auth fields
  password: "password",
  first_name: "firstName",
  last_name: "lastName",
  new_password: "newPassword",

  // Project fields
  title: "title",
  description: "description",
  status: "status",
  full_budget: "fullBudget",
  reserved_budget: "reservedBudget",
  customer_budget: "customerBudget",
  project_manager_id: "projectManagerId",
  due_date: "dueDate",

  // Invoice fields
  discount: "discount",
  tax: "tax",
  unit_price: "unitPrice",
  quantity: "quantity",
  item_type: "itemType",

  // Payment fields
  amount: "amount",
  method: "method",
  customer_email: "customerEmail",
  invoice_id: "invoiceId",

  // Client fields
  company: "company",

  // CMS fields
  slug: "slug",
  section_key: "sectionKey",

  // Content fields
  image_url: "imageUrl",
  link_url: "linkUrl",

  // Contract fields
  contract_number: "contractNumber",

  // Generic
  reason: "reason",
  content: "content",
  subject: "subject",
  recipient: "recipient",
  message: "message",
  url: "url",
  username: "username",
}

/**
 * Strip the common "Value error, " prefix that FastAPI/Pydantic adds.
 */
function cleanPydanticMessage(msg: string): string {
  let cleaned = msg.trim()
  // Remove "Value error, " or "Value error," prefix
  if (/^value\s+error,?\s*/i.test(cleaned)) {
    cleaned = cleaned.replace(/^value\s+error,?\s*/i, "")
  }
  return cleaned
}

/**
 * Map a backend field name (snake_case) to a frontend field name (camelCase).
 * Returns the original name if no mapping exists.
 */
function mapFieldName(backendName: string): string {
  // Handle "body.field_name" or "query.field_name" etc.
  const parts = backendName.split(".")
  const rawField = parts[parts.length - 1]
  return FIELD_MAP[rawField] || rawField
}

/**
 * Extract field-level errors from a Pydantic validation error array.
 * Returns a record mapping frontend field names to human-readable messages.
 */
function extractFieldErrors(detail: any[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const item of detail) {
    if (!item || typeof item !== "object") continue

    const msg = item.msg || item.message || ""
    if (!msg) continue

    const cleaned = cleanPydanticMessage(String(msg))

    // Extract field name from loc array (e.g. ["body", "detailed_requirements"])
    if (Array.isArray(item.loc) && item.loc.length >= 2) {
      const backendField = String(item.loc[item.loc.length - 1])
      const frontendField = mapFieldName(backendField)

      // For field errors, prefer the first error per field
      if (!fieldErrors[frontendField]) {
        fieldErrors[frontendField] = cleaned
      }
    }
  }

  return fieldErrors
}

/**
 * Build a single human-readable message from a Pydantic validation error array.
 * Used as the top-level `message` when field errors are also present.
 */
function buildValidationSummary(detail: any[]): string {
  if (!Array.isArray(detail) || detail.length === 0) {
    return "Please check your input and try again."
  }

  const messages = detail
    .filter((item) => item && typeof item === "object" && item.msg)
    .map((item) => cleanPydanticMessage(String(item.msg)))

  if (messages.length === 0) {
    return "Please check your input and try again."
  }

  if (messages.length === 1) {
    return messages[0]
  }

  return `Please correct the following:\n${messages.map((m) => `• ${m}`).join("\n")}`
}

/**
 * Safely parse a response body as JSON, returning null on any failure.
 */
async function safeParseJson(response: Response): Promise<any> {
  try {
    const text = await response.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

/**
 * Normalize an API error response into a structured, human-readable result.
 *
 * Handles ALL common backend response shapes:
 * - Pydantic validation error array: { detail: [{ msg, loc, type }] }
 * - Simple string detail: { detail: "message" }
 * - Message object: { message: "..." }
 * - Plain text response
 * - Empty response
 * - HTML 500/502/503 pages
 * - Network failure
 *
 * NEVER throws while trying to parse an error.
 */
export async function normalizeApiError(
  response: Response,
  fallback = "An unexpected error occurred"
): Promise<NormalizedApiError> {
  const status = response.status
  const data = await safeParseJson(response)

  // A. Pydantic validation error array
  if (data && Array.isArray(data.detail)) {
    const fieldErrors = extractFieldErrors(data.detail)
    const message = buildValidationSummary(data.detail)
    return { message, fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined, status }
  }

  // B. Simple string detail
  if (data && typeof data.detail === "string") {
    return { message: data.detail, status }
  }

  // C. Message object
  if (data && typeof data.message === "string") {
    return { message: data.message, status }
  }

  // D. Plain text response
  if (data && typeof data === "string") {
    return { message: data, status }
  }

  // E. Empty response or non-JSON
  if (!data) {
    // Check if response looks like HTML (500/502/503 error pages)
    if (status >= 500) {
      return { message: "The server encountered an error. Please try again later.", status }
    }
    if (status === 404) {
      return { message: "The requested resource was not found.", status }
    }
    if (status === 401) {
      return { message: "Your session has expired. Please log in again.", status }
    }
    if (status === 403) {
      return { message: "You do not have permission to perform this action.", status }
    }
    if (status === 429) {
      return { message: "Too many requests. Please wait a moment and try again.", status }
    }
    return { message: fallback, status }
  }

  // F. Unknown response shape — never expose raw object
  return { message: fallback, status }
}

/**
 * Convenience wrapper for use in catch blocks.
 * Extracts message from an Error or returns a fallback.
 */
export function extractError(err: unknown, fallback = "An unexpected error occurred"): string {
  if (err instanceof Error) return err.message || fallback
  if (typeof err === "string") return err
  return fallback
}
