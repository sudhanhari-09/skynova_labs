import React, { useCallback, useEffect, useState } from "react"
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  fetchRoles,
  AdminUser,
  RoleInfo,
} from "../../services/api"
import {
  PageHeader,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Badge,
  Button,
  Input,
  Label,
  EmptyState,
  Skeleton,
  StateError,
  useToastAction,
} from "../../components/ui"

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—")

const Team: React.FC = () => {
  const run = useToastAction()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "", role: "" })

  const load = useCallback(() => {
    return Promise.all([fetchAdminUsers(), fetchRoles()])
      .then(([u, r]) => { setUsers(u); setRoles(r) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim() || !form.phone.trim()) return
    run(async () => {
      await createAdminUser({
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        phone: form.phone,
        roles: form.role ? [form.role] : [],
      })
      setForm({ first_name: "", last_name: "", email: "", phone: "", password: "", role: "" })
      await load()
    }, { success: "Team member created" })
  }

  const toggleActive = (u: AdminUser) => {
    run(async () => {
      await updateAdminUser(u.id, { is_active: !u.is_active })
      await load()
    }, { success: u.is_active ? "Deactivated" : "Activated" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Team" subtitle="People working in and around Project Labs." />

        {error && <StateError message={error} onRetry={load} />}

        <form onSubmit={submit} className="bg-white rounded-lg shadow p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <div><Label>First name</Label><Input value={form.first_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><Label>Last name</Label><Input value={form.last_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, last_name: e.target.value })} /></div>
          <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone *</Label><Input type="tel" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, password: e.target.value })} /></div>
          <div><Label>Role</Label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-9 w-full rounded-md border border-gray-300 px-2 text-sm">
              <option value="">Default</option>
              {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button className="btn btn-primary w-full">+ Invite</Button></div>
        </form>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold">Roles</div>
          <div className="p-5 flex flex-wrap gap-2">
            {roles.length === 0 && <p className="text-sm text-gray-500">No roles exposed.</p>}
            {roles.map((r) => (
              <span key={r.id} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm">
                {r.name} <span className="text-xs opacity-70">({r.permissions.length} perms)</span>
              </span>
            ))}
          </div>
        </div>

        {!users ? (
          <Skeleton className="h-64 w-full" />
        ) : users.length === 0 ? (
          <EmptyState title="No team members yet" />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Member since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{(u.first_name || "") + " " + (u.last_name || "") || "—"}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm text-gray-500">{u.phone || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles.length ? u.roles : ["User"]).map((r) => (
                          <Badge key={r} className="bg-blue-100 text-blue-800">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={u.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                        {u.is_active ? "ACTIVE" : "INACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtTime(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button className="btn btn-outline btn-xs" onClick={() => toggleActive(u)}>
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
              {users.length} user accounts · {roles.length} roles
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default Team