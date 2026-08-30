import React, { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { fetchNotifications, markNotificationRead, Notification } from "../services/api"
import { Bell } from "../components/icons"

/**
 * Header notification bell with unread badge and dropdown.
 * Fetches recent notifications from the backend. If the API is
 * unavailable it fails silently (no unread count shown) and links
 * through to the full notifications page.
 */
const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [failed, setFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const load = async () => {
    try {
      const data = await fetchNotifications(false, 1, 6)
      setItems(data.notifications || [])
      setUnread(data.unread_count || 0)
      setFailed(false)
    } catch (_) {
      setItems([])
      setUnread(0)
      setFailed(true)
    }
  }

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [])

  // Close on route change.
  useEffect(() => setOpen(false), [location.pathname])

  // Outside click + Escape handling.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:bg-gray-100 relative"
        onClick={() => {
          if (!open) load()
          setOpen((o) => !o)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="bell-dropdown" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && <span className="text-xs text-gray-500">{unread} unread</span>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {failed && (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">
                Notifications are unavailable right now.
              </p>
            )}
            {!failed && items.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">You're all caught up.</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={async () => {
                  setOpen(false)
                  try {
                    await markNotificationRead(n.id)
                    setUnread((u) => Math.max(0, u - 1))
                  } catch (_) {
                    /* silent */
                  }
                }}
                className={`block w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 ${
                  n.is_read ? "opacity-70" : ""
                }`}
              >
                <div className="text-sm font-medium text-gray-900">{n.title}</div>
                {n.body && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>}
                <div className="text-[11px] text-gray-400 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
          <Link to="/admin/notifications" className="block px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 border-t border-gray-100">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
