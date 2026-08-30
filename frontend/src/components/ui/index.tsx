import React from "react"
import { Link } from "react-router-dom"

/* ============================================================
   PROJECT LABS — shared UI system
   Buttons, form controls, tables, badges, loading, empty,
   error, pagination, modal/dialog and toast primitives.
   ============================================================ */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link"
  size?: "sm" | "md" | "lg"
  loading?: boolean
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer"

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-800",
  secondary: "border border-gray-300 text-gray-900 hover:bg-gray-50 bg-white",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 bg-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700",
  link: "bg-transparent p-0 text-blue-600 hover:text-blue-800 hover:underline font-medium",
}

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className = "",
  children,
  ...props
}) => (
  <button
    className={`${buttonBase} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <span className="spinner spinner--sm" aria-hidden="true" />}
    {children}
  </button>
)

export const IconButton: React.FC<ButtonProps> = ({
  variant = "ghost",
  className = "",
  children,
  "aria-label": ariaLabel,
  ...props
}) => (
  <button
    className={`inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors ${variantClasses[variant]} ${className}`}
    aria-label={ariaLabel || "action"}
    {...props}
  >
    {children}
  </button>
)

export const Label = ({
  children,
  htmlFor,
  required,
  hint,
  ...props
}: any) => (
  <div className="mb-1">
    <label htmlFor={htmlFor} className="label" {...props}>
      {children}
      {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
    </label>
    {hint && <span className="text-xs text-gray-500">{hint}</span>}
  </div>
)

export const Input = React.forwardRef<HTMLInputElement, any>(
  ({ type = "text", className = "", invalid, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={`input input-bordered w-full ${invalid ? "!border-red-500" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
)
Input.displayName = "Input"

export const Textarea = React.forwardRef<HTMLTextAreaElement, any>(
  ({ className = "", invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`input input-bordered w-full ${invalid ? "!border-red-500" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export const Select = React.forwardRef<HTMLSelectElement, any>(
  ({ className = "", invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      className={`input input-bordered w-full ${invalid ? "!border-red-500" : ""} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = "Select"

export const FieldError = ({ children }: any) =>
  children ? <p className="mt-1 text-xs font-medium text-red-600" role="alert">{children}</p> : null

/* ---------- Alert ---------- */
export const alert_variants = {
  default: "bg-red-50 text-red-800 border-red-200",
  error: "bg-red-50 text-red-800 border-red-200",
  success: "bg-green-50 text-green-800 border-green-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
}

export const Alert = ({ variant = "error", children, className = "" }: any) => (
  <div role="alert" className={`rounded-md border px-4 py-3 text-sm ${alert_variants[variant as keyof typeof alert_variants] || alert_variants.error} ${className}`}>
    {children}
  </div>
)

/* ---------- Tables ---------- */
export const Table = ({ children, className = "" }: any) => (
  <div className="overflow-x-auto">
    <table className={`min-w-full divide-y divide-gray-200 ${className}`}>{children}</table>
  </div>
)

export const TableHeader = ({ children, className = "" }: any) => (
  <thead className={`bg-gray-50 ${className}`}>{children}</thead>
)

export const TableRow = ({ children, className = "" }: any) => (
  <tr className={`bg-white hover:bg-gray-50 ${className}`}>{children}</tr>
)

export const TableCell = ({ children, colSpan, className = "" }: any) => (
  <td colSpan={colSpan} className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
)

export const TableHead = ({ children, className = "" }: any) => (
  <th scope="col" className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${className}`}>{children}</th>
)

export const Badge = ({ children, className = "" }: any) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${className}`}>{children}</span>
)

/* ---------- Tabs ---------- */
export const Tabs = ({ className = "", children }: any) => <div className={className}>{children}</div>

export const TabsList = ({ children, className = "" }: any) => (
  <div className={`flex flex-wrap gap-1 border-b border-gray-200 mb-4 ${className}`} role="tablist">
    {children}
  </div>
)

export const TabsTrigger = ({ children, className = "", active, onClick }: any) => (
  <button
    type="button"
    role="tab"
    aria-selected={!!active}
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-t-md -mb-px transition-colors ${
      active
        ? "border border-gray-200 border-b-white bg-white text-blue-600"
        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    } ${className || ""}`}
  >
    {children}
  </button>
)

export const TabsContent = ({ children, active }: any) => (active ? <div role="tabpanel">{children}</div> : null)

export const Tab = TabsTrigger
/* ============================================================
   Loading / empty / error / pagination / status
   ============================================================ */

export const Spinner = ({ className = "", label = "Loading" }: any) => (
  <div className={`flex items-center justify-center gap-2 text-gray-500 ${className}`} role="status">
    <span className="spinner" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
)

export type EmptyStateAction = { label: string; onClick: () => void } | { label: string; to: string }

export const EmptyState = ({
  title,
  description,
  icon = "??",
  action,
  className = "",
}: {
  title: string
  description?: string
  icon?: string
  action?: EmptyStateAction
  className?: string
}) => {
  const renderAction = () => {
    if (!action) return null
    const cls = "btn-primary mt-4"
    if ("to" in action) {
      return (
        <Link to={action.to} className={cls}>
          {action.label}
        </Link>
      )
    }
    return (
      <button type="button" className={cls} onClick={action.onClick}>
        {action.label}
      </button>
    )
  }
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-gray-500 mt-1 max-w-md mx-auto">{description}</p>}
      {renderAction()}
    </div>
  )
}

export const StateError = ({ message, onRetry, title = "Something went wrong" }: any) => (
  <div className="text-center py-10 px-4" role="alert">
    <div className="text-4xl mb-3" aria-hidden="true">??</div>
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <p className="text-gray-500 mt-1 text-sm max-w-md mx-auto">{message || "An unexpected error occurred. Please try again."}</p>
    {onRetry && (
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
)

export const PageHeader = ({ title, subtitle, actions, backTo }: any) => (
  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
    <div>
      {backTo && (
        <Link to={backTo} className="btn-link inline-flex items-center gap-1 mb-1">
          ← Back
        </Link>
      )}
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
)

export const Skeleton = ({ className = "", rows = 1, label }: any) => (
  <div className="space-y-2" role={label ? "status" : undefined} aria-label={label}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={`animate-pulse rounded bg-gray-200 ${className}`} style={{ minHeight: 12 }} />
    ))}
  </div>
)

export const PageSkeleton = ({ title }: any) => (
  <div className="py-6" role="status" aria-label="Loading">
    <Skeleton className="h-6 w-48" />
    <div className="mt-6">
      <Skeleton className="h-64 w-full" rows={2} />
    </div>
  </div>
)

export const Pagination = ({ page, pageSize, total, onPageChange, className = "" }: any) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 50)))
  if (totalPages <= 1) return null
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="text-sm text-gray-500">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export const StatusBadge = ({ status, className = "" }: any) => {
  const normalized = (status || "").toUpperCase().replace(/_/g, " ")
  const colorMap: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    PAID: "bg-green-100 text-green-800",
    SUCCEEDED: "bg-green-100 text-green-800",
    RELEASED: "bg-green-100 text-green-800",
    COMPLETED: "bg-green-100 text-green-800",
    RESOLVED: "bg-green-100 text-green-800",
    LAUNCHED: "bg-green-100 text-green-800",
    ACCEPTED: "bg-green-100 text-green-800",
    WON: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-100 text-gray-600",
    DRAFT: "bg-gray-100 text-gray-600",
    PLANNED: "bg-gray-100 text-gray-600",
    BACKLOG: "bg-gray-100 text-gray-600",
    ARCHIVED: "bg-gray-100 text-gray-600",
    SCHEDULED: "bg-yellow-100 text-yellow-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    INTERNAL_REVIEW: "bg-yellow-100 text-yellow-800",
    WAITING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    OPEN: "bg-blue-100 text-blue-800",
    ITERATING: "bg-blue-100 text-blue-800",
    PARTIALLY_PAID: "bg-blue-100 text-blue-800",
    VIEWED: "bg-blue-100 text-blue-800",
    SENT: "bg-blue-100 text-blue-800",
    BETA: "bg-purple-100 text-purple-800",
    OVERDUE: "bg-red-100 text-red-800",
    CANCELLED: "bg-red-100 text-red-800",
    FAILED: "bg-red-100 text-red-800",
    ROLLED_BACK: "bg-red-100 text-red-800",
    EXPIRED: "bg-red-100 text-red-800",
    REJECTED: "bg-red-100 text-red-800",
    LOST: "bg-red-100 text-red-800",
    URGENT: "bg-red-100 text-red-800",
    HIGH: "bg-red-100 text-red-800",
    CRITICAL: "bg-red-100 text-red-800",
    LOW: "bg-gray-100 text-gray-600",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    PREMIUM: "bg-yellow-100 text-yellow-800",
  }
  const tone = colorMap[normalized] || "bg-gray-100 text-gray-700"
  return <Badge className={`${tone} ${className}`}>{status}</Badge>
}
/* ============================================================
   Modal / Confirm dialog (accessible, focus-trapped)
   ============================================================ */

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  width,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) => {
  const overlayRef = React.useRef<HTMLDivElement>(null)
  const modalRef = React.useRef<HTMLDivElement>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () => {
      if (!modalRef.current) return []
      return Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"))
    }

    const focusFirst = () => {
      const els = focusables()
      const first = els[0] || modalRef.current
      first?.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== "Tab") return
      const els = focusables()
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    focusFirst()

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div ref={modalRef} className="modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <h3 className="modal__title">{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-sm text-gray-600">{message}</p>
  </Modal>
)

/* ============================================================
   Toast notification system
   ============================================================ */

export type ToastVariant = "success" | "error" | "warning" | "info"

export interface ToastItem {
  id: number
  variant: ToastVariant
  title: string
  message?: string
}

const ToastContext = React.createContext<{
  toast: (variant: ToastVariant, title: string, message?: string) => void
} | null>(null)

let toastIdCounter = 0

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = ++toastIdCounter
      setToasts((prev) => [...prev.slice(-3), { id, variant, title, message }])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss]
  )

  const value = React.useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.variant}`} role="status">
            <div className="toast__body">
              <div className="toast__title">{t.title}</div>
              {t.message && <div className="toast__message">{t.message}</div>}
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    // Safe fallback: no-op toast when used outside the provider (avoids crashes).
    return { toast: () => {} }
  }
  return ctx
}

/* Hook that turns a promise result into toast feedback. */
export const useToastAction = () => {
  const { toast } = useToast()
  return React.useCallback(
    async (fn: () => Promise<any>, messages: { success: string; error?: string }) => {
      try {
        await fn()
        toast("success", messages.success)
        return true
      } catch (e: any) {
        toast("error", messages.error || "Something went wrong", e?.message || undefined)
        return false
      }
    },
    [toast]
  )
}
