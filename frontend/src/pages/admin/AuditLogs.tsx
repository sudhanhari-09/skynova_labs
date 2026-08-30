import React, { useCallback, useEffect, useState } from "react"
import { fetchAuditLogs, fetchAuditStats, AuditLog, AuditStats } from "../../services/api"
import { PageHeader, Table, TableHeader, TableRow, TableCell, TableHead, Badge, StateError, EmptyState, Skeleton } from "../../components/ui"

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—")

const badgeForAction = (action: string) => {
  const a = action.toLowerCase()
  if (a.includes("create") || a.includes("convert")) return <Badge className="bg-green-100 text-green-800">{action}</Badge>
  if (a.includes("update") || a.includes("edit")) return <Badge className="bg-blue-100 text-blue-800">{action}</Badge>
  if (a.includes("delete")) return <Badge className="bg-red-100 text-red-800">{action}</Badge>
  if (a.includes("login") || a.includes("logout") || a.includes("auth")) return <Badge className="bg-purple-100 text-purple-800">{action}</Badge>
  return <Badge className="bg-gray-100 text-gray-600">{action}</Badge>
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[] | null>(null)
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    return Promise.all([fetchAuditLogs(250).catch(() => [] as AuditLog[]), fetchAuditStats().catch(() => null)]).then(([l, s]) => {
      setLogs(l)
      setStats(s)
    })
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Audit Log" subtitle="System-wide admin actions, logins and API hits." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total ?? "—"}</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</div>
            </div>
            {Object.entries(stats.by_action).map(([k, v]) => (
              <div key={k} className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-gray-900">{v}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{k}</div>
              </div>
            ))}
          </div>
        )}

        {!logs ? (
          <Skeleton className="h-64 w-full" />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit events yet" />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500">{fmtTime(l.timestamp)}</TableCell>
                    <TableCell>{badgeForAction(l.action)}</TableCell>
                    <TableCell className="text-sm">{l.actor || `#${l.user_id ?? "—"}`}</TableCell>
                    <TableCell className="text-sm">{l.module || "—"}</TableCell>
                    <TableCell className="text-sm">{l.entity_type ? `${l.entity_type}${l.entity_id ? ` #${l.entity_id}` : ""}` : "—"}</TableCell>
                    <TableCell className="text-xs text-gray-500">{l.request_ip || "—"}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}

export default AuditLogs