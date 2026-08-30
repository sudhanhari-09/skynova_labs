import React, { useCallback, useEffect, useState } from "react"
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "../../services/api"
import { PageHeader, Skeleton, StateError, EmptyState, Button, StatusBadge } from "../../components/ui"

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = useCallback(async (onlyUnread: boolean) => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchNotifications(onlyUnread, 1, 50)
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
    } catch (e: any) {
      setError(e.message || "Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(unreadOnly) }, [unreadOnly, load])

  const handleRead = async (id: number) => {
    try {
      await markNotificationRead(id)
      await load(unreadOnly)
    } catch (e) {
      console.error(e)
    }
  }

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead()
      await load(unreadOnly)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <main>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        actions={
          <>
            <Button
              className={unreadOnly ? "!bg-gray-100 !text-gray-800" : "btn-secondary"}
              onClick={() => setUnreadOnly(!unreadOnly)}
            >
              {unreadOnly ? "Show all" : "Unread only"}
            </Button>
            {unreadCount > 0 && <Button onClick={handleReadAll}>Mark all read</Button>}
          </>
        }
      />

      {loading && <Skeleton className="h-6 w-full" rows={6} />}
      {!loading && error && <StateError message={error} onRetry={() => load(unreadOnly)} />}
      {!loading && !error && notifications.length === 0 && (
        <EmptyState title="No notifications" description="You are all caught up." />
      )}
      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <button
              key={n.id}
              type="button"
              className={`card w-full text-left hover:border-blue-200 ${n.is_read ? "opacity-60" : ""}`}
              onClick={() => !n.is_read && handleRead(n.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={n.notification_type} />
                  <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {n.body && <p className="text-sm text-gray-600 mt-1">{n.body}</p>}
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

export default Notifications