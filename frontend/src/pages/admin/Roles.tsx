import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchPermissions,
  RoleInfo,
  PermissionInfo,
} from "../../services/api"
import {
  PageHeader,
  Badge,
  Button,
  Input,
  Label,
  EmptyState,
  Skeleton,
  StateError,
  ConfirmDialog,
  useToastAction,
} from "../../components/ui"

const Roles: React.FC = () => {
  const run = useToastAction()
  const [roles, setRoles] = useState<RoleInfo[] | null>(null)
  const [permissions, setPermissions] = useState<PermissionInfo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<RoleInfo | null>(null)

  const load = useCallback(() => {
    return Promise.all([fetchRoles(), fetchPermissions()])
      .then(([r, p]) => {
        setRoles(r)
        setPermissions(p)
        setSelectedId((cur) => cur ?? r[0]?.id ?? null)
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  const selected = useMemo(() => roles?.find((r) => r.id === selectedId) ?? null, [roles, selectedId])
  const [draftDesc, setDraftDesc] = useState("")
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDraftDesc(selected?.description ?? "")
    setDraftPerms(new Set(selected?.permissions ?? []))
  }, [selected])

  const groups = useMemo(() => {
    const m = new Map<string, PermissionInfo[]>()
    for (const p of permissions) {
      const list = m.get(p.resource) ?? []
      list.push(p)
      m.set(p.resource, list)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions])

  const togglePerm = (key: string) => {
    setDraftPerms((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const save = () => {
    if (!selected) return
    run(async () => {
      await updateRole(selected.id, { description: draftDesc || null, permissions: Array.from(draftPerms) })
      await load()
    }, { success: "Role saved" })
  }

  const createNew = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return
    run(async () => {
      const role = await createRole({ name: newRoleName.trim() })
      setNewRoleName("")
      setSelectedId(role.id)
      await load()
    }, { success: "Role created" })
  }

  const doDelete = () => {
    if (!confirmDelete) return
    run(async () => {
      await deleteRole(confirmDelete.id)
      setConfirmDelete(null)
      setSelectedId(null)
      await load()
    }, { success: "Role deleted" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Roles & Permissions" subtitle="Manage what each role can do across the workspace." />

        {error && <StateError message={error} onRetry={load} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <form onSubmit={createNew} className="bg-white rounded-lg shadow p-4">
              <div className="font-semibold mb-2">New role</div>
              <div className="flex gap-2">
                <Input value={newRoleName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoleName(e.target.value)} placeholder="e.g. Project Manager" />
                <Button className="btn btn-primary">+ Add</Button>
              </div>
            </form>

            {!roles ? (
              <Skeleton className="h-64 w-full" />
            ) : roles.length === 0 ? (
              <EmptyState title="No roles yet" />
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-blue-50/50 transition-colors ${selectedId === r.id ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{r.name}</span>
                      <Badge className="bg-blue-100 text-blue-800">{r.permissions.length} perms</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.description || "No description"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {!selected ? (
              <EmptyState title="Select a role" description="Pick a role from the list to edit its permissions." />
            ) : (
              <div className="bg-white rounded-lg shadow p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{selected.name}</div>
                    <div className="text-sm text-gray-500">Roles are assigned to team members; permissions gate what each member can do.</div>
                  </div>
                  <Button className="btn btn-outline btn-sm text-red-600" onClick={() => setConfirmDelete(selected)}>Delete</Button>
                </div>

                <div className="mb-5">
                  <Label>Description</Label>
                  <Input value={draftDesc} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftDesc(e.target.value)} placeholder="What does this role own?" />
                </div>

                <div className="text-sm font-semibold text-gray-700 mb-2">Permissions</div>
                <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
                  {groups.map(([resource, perms]) => (
                    <div key={resource} className="rounded-lg border border-gray-100">
                      <div className="px-4 py-2 bg-gray-50 rounded-t-lg font-mono text-xs font-semibold text-gray-600 uppercase tracking-wide">{resource}</div>
                      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {perms.map((p) => {
                          const key = `${p.resource}:${p.action}`
                          const checked = draftPerms.has(key)
                          return (
                            <label key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border text-sm ${checked ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-100 text-gray-700 hover:bg-gray-50"}`}>
                              <input type="checkbox" checked={checked} onChange={() => togglePerm(key)} className="accent-blue-600" />
                              <span className="font-mono text-xs">{p.action}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex justify-end">
                  <Button className="btn btn-primary" onClick={save}>Save Role</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog open={!!confirmDelete} onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} title="Delete role?" message={`Delete role "${confirmDelete?.name}"? Built-in and assigned roles cannot be deleted.`} />
    </main>
  )
}

export default Roles