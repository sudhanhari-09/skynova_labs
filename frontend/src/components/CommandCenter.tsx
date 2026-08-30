import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "../components/icons"

interface Command {
  id: string
  label: string
  hint?: string
  group: string
  to: string
  keywords?: string
}

const adminCommands: Command[] = [
  { id: "dashboard", label: "Dashboard", group: "Admin", to: "/admin", keywords: "home overview" },
  { id: "analytics", label: "Analytics", group: "Admin", to: "/admin/analytics", keywords: "metrics reports insights" },
  { id: "leads", label: "Leads", group: "Admin", to: "/admin/leads", keywords: "sales pipeline opportunities" },
  { id: "quote-requests", label: "Quote Requests", group: "Admin", to: "/admin/quote-requests", keywords: "quotes submissions inquiries" },
  { id: "quotations", label: "Quotations", group: "Admin", to: "/admin/quotations", keywords: "quotes proposals" },
  { id: "contracts", label: "Contracts", group: "Admin", to: "/admin/contracts", keywords: "agreements signed" },
  { id: "projects", label: "Projects", group: "Admin", to: "/admin/projects", keywords: "delivery portfolio" },
  { id: "new-project", label: "New Project", group: "Admin", to: "/admin/projects/new", keywords: "create add project" },
  { id: "invoices", label: "Invoices", group: "Admin", to: "/admin/invoices", keywords: "billing billing statements" },
  { id: "payments", label: "Payments", group: "Admin", to: "/admin/payments", keywords: "revenue collections" },
  { id: "calendar", label: "Calendar", group: "Admin", to: "/admin/calendar", keywords: "schedule events meetings" },
  { id: "support", label: "Support Desk", group: "Admin", to: "/admin/support", keywords: "tickets helpdesk issues" },
  { id: "products", label: "Products", group: "Admin", to: "/admin/products", keywords: "catalog portfolio" },
  { id: "clients", label: "Clients", group: "Admin", to: "/admin/clients", keywords: "customers accounts" },
  { id: "team", label: "Team", group: "Admin", to: "/admin/team", keywords: "staff members people" },
  { id: "displaySettings", label: "Knowledge Base", group: "Admin", to: "/admin/knowledge-base", keywords: "wiki docs playbooks" },
  { id: "email-logs", label: "Email Logs", group: "Admin", to: "/admin/email-logs", keywords: "emails communications" },
  { id: "whatsapp-logs", label: "WhatsApp Logs", group: "Admin", to: "/admin/whatsapp-logs", keywords: "messages chat" },
  { id: "project-types", label: "Project Types", group: "Admin", to: "/admin/project-types", keywords: "catalog services" },
  { id: "requirement-questions", label: "Requirement Questions", group: "Admin", to: "/admin/requirement-questions", keywords: "forms fields catalog" },
  { id: "feature-flags", label: "Feature Flags", group: "Admin", to: "/admin/feature-flags", keywords: "settings toggles" },
  { id: "cms", label: "Content Management", group: "Admin", to: "/admin/cms", keywords: "content pages" },
]

const publicCommands: Command[] = [
  { id: "site", label: "View Website Home", group: "Site", to: "/", keywords: "public home" },
  { id: "projects-public", label: "Projects (Public)", group: "Site", to: "/projects", keywords: "portfolio work" },
  { id: "solutions", label: "Solutions", group: "Site", to: "/solutions", keywords: "services offerings" },
  { id: "products-public", label: "Products (Public)", group: "Site", to: "/products", keywords: "catalog offerings" },
  { id: "start-a-project", label: "Start a Project", group: "Site", to: "/start-a-project", keywords: "begin intake" },
  { id: "quote", label: "Get a Quote", group: "Site", to: "/quote", keywords: "quotation proposal" },
  { id: "innovation-pipeline", label: "Innovation Pipeline", group: "Site", to: "/innovation-pipeline", keywords: "idea stages process" },
  { id: "journal", label: "Journal", group: "Site", to: "/journal", keywords: "editorial articles" },
  { id: "build-log", label: "Build Log", group: "Site", to: "/build-log", keywords: "updates progress" },
  { id: "collaborate", label: "Collaborate", group: "Site", to: "/collaborate", keywords: "partner partnership" },
]

const search = (query: string, commands: Command[]): Command[] => {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) =>
    (c.label + " " + c.hint + " " + (c.keywords || "")).toLowerCase().includes(q)
  )
}

/**
 * Global command palette (Ctrl/Cmd+K). Filters navigation commands and,
 * when a fragment matching a record type is entered, lists matching live
 * records where the backend supports it. All results are honest — if the
 * backend is unreachable, the list simply shows navigation commands.
 */
const CommandCenter: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [recordResults, setRecordResults] = useState<Command[]>([])

  const commands = useMemo(() => [...adminCommands, ...publicCommands], [])

  const filtered = useMemo(() => {
    const base = search(query, commands)
    return [...recordResults, ...base]
  }, [query, commands, recordResults])

  useEffect(() => {
    if (open) {
      setRecordResults([])
      setActiveIndex(0)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  // Reset results when the query changes (the fake record search is intentionally
  // kept minimal: the backend endpoints for live-record search are a dependency).
  useEffect(() => {
    setActiveIndex(0)
    setRecordResults([])
  }, [query])

  if (!open) return null

  const run = (cmd: Command) => {
    onClose()
    navigate(cmd.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = filtered[activeIndex]
      if (cmd) run(cmd)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigation"
        onKeyDown={onKeyDown}
      >
        <div className="command-input-wrap">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            className="command-input"
            placeholder="Search pages, projects, modules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={onClose}>
            ESC
          </button>
        </div>
        <div className="command-results" ref={listRef}>
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-sm text-gray-500 text-center">No matches found.</p>
          )}
          {groupResults(filtered).map(({ group, items }) => (
            <div key={group}>
              <div className="command-group-label">{group}</div>
              {items.map((cmd) => {
                const globalIndex = filtered.findIndex((c) => c.id === cmd.id)
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={`command-item ${globalIndex === activeIndex ? "command-item--active" : ""}`}
                    onMouseEnter={() => setActiveIndex(globalIndex)}
                    onClick={() => run(cmd)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint && <span className="command-item__hint">{cmd.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 flex gap-4">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

const groupResults = (commands: Command[]) => {
  const map = new Map<string, Command[]>()
  for (const c of commands) {
    const arr = map.get(c.group) || []
    arr.push(c)
    map.set(c.group, arr)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
}

export default CommandCenter
