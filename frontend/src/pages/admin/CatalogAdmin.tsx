import React, { useCallback, useEffect, useState } from "react"
import {
  createIndustry,
  createService,
  createTechnology,
  deleteIndustry,
  deleteService,
  deleteTechnology,
  fetchAdminIndustries,
  fetchAdminServices,
  fetchAdminTechnologies,
  Industry,
  Service,
  Technology,
  updateIndustry,
  updateService,
  updateTechnology,
} from "../../services/api"
import {
  PageHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableRow,
  TableCell,
  TableHead,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  Modal,
  ConfirmDialog,
  StateError,
  EmptyState,
  useToastAction,
} from "../../components/ui"

interface RowForm {
  name: string
  slug: string
  description: string
  category: string
  display_order: number
  is_active: boolean
  is_public: boolean
}

const emptyForm = (): RowForm => ({
  name: "", slug: "", description: "", category: "", display_order: 0, is_active: true, is_public: true,
})

interface RowStruct {
  id?: number | null
  name?: string
  slug?: string | null
  description?: string | null
  category?: string | null
  is_active?: boolean | null
  is_public?: boolean | null
  display_order?: number | null
}

const CatalogAdmin: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<"services" | "technologies" | "industries">("services")
  const [services, setServices] = useState<Service[]>([])
  const [technologies, setTechnologies] = useState<Technology[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<RowForm>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [s, t, i] = await Promise.all([
      fetchAdminServices().catch(() => []),
      fetchAdminTechnologies().catch(() => []),
      fetchAdminIndustries().catch(() => []),
    ])
    setServices(s)
    setTechnologies(t)
    setIndustries(i)
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const openAdd = () => {
    setForm(emptyForm())
    setEditingId(null)
    setModal(true)
  }

  const openEdit = (row: RowStruct) => {
    setForm({
      name: row.name || "",
      slug: row.slug || "",
      description: row.description || "",
      category: row.category || "",
      display_order: row.display_order ?? 0,
      is_active: row.is_active ?? true,
      is_public: row.is_public ?? true,
    })
    setEditingId(row.id ?? null)
    setModal(true)
  }

  const save = () => {
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description || null,
      category: form.category || null,
      display_order: form.display_order,
      is_active: form.is_active,
      is_public: form.is_public,
    }
    run(async () => {
      if (tab === "services") editingId ? await updateService(editingId, payload) : await createService(payload)
      else if (tab === "technologies") editingId ? await updateTechnology(editingId, payload) : await createTechnology(payload)
      else editingId ? await updateIndustry(editingId, payload) : await createIndustry(payload)
      setModal(false)
      await load()
    }, { success: "Saved" })
  }

  const remove = () => {
    if (!deleteId) return
    run(async () => {
      if (tab === "services") await deleteService(deleteId)
      else if (tab === "technologies") await deleteTechnology(deleteId)
      else await deleteIndustry(deleteId)
      setDeleteId(null)
      await load()
    }, { success: "Deleted" })
  }

  const rows: RowStruct[] =
    tab === "services" ? services : tab === "technologies" ? technologies : industries

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Catalog" subtitle="Services, technologies and industries shown on the public site." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (
          <Tabs>
            <TabsList>
              <TabsTrigger active={tab === "services"} onClick={() => { setTab("services"); setDeleteId(null) }}>Services</TabsTrigger>
              <TabsTrigger active={tab === "technologies"} onClick={() => { setTab("technologies"); setDeleteId(null) }}>Technologies</TabsTrigger>
              <TabsTrigger active={tab === "industries"} onClick={() => { setTab("industries"); setDeleteId(null) }}>Industries</TabsTrigger>
            </TabsList>

            <TabsContent active>
              <div className="flex justify-end mb-4">
                <Button onClick={openAdd}>+ Add {tab === "industries" ? "industry" : tab.slice(0, -1)}</Button>
              </div>
              {rows.length === 0 ? (
                <EmptyState title={`No ${tab} yet`} description="Add entries to populate the public site." />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {rows.map((r) => (
                        <TableRow key={r.id || r.name}>
                          <TableCell className="font-medium text-gray-900">{r.name}</TableCell>
                          <TableCell>{r.category || "—"}</TableCell>
                          <TableCell>
                            {r.is_active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>}
                            {r.is_public ? <Badge className="ml-1 bg-blue-100 text-blue-800">Public</Badge> : null}
                          </TableCell>
                          <TableCell>{r.display_order ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="secondary" size="sm" className="mr-2" onClick={() => openEdit(r)}>Edit</Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(r.id ?? null)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Modal open={modal} onClose={() => setModal(false)} title={`${editingId ? "Edit" : "Add"} ${tab.slice(0, -1)}`}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fname" required>Name</Label>
              <Input id="fname" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="fslug">Slug</Label>
              <Input id="fslug" value={form.slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto-generated from name" />
            </div>
            <div>
              <Label htmlFor="fcat">Category</Label>
              <Input id="fcat" value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="fdesc">Description</Label>
              <Textarea id="fdesc" rows={3} value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.display_order} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
                Public
              </label>
            </div>
            <Button className="w-full" onClick={save}>{editingId ? "Save changes" : "Create"}</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          title="Delete entry"
          message="Delete this catalog entry? This cannot be undone."
          destructive
          onCancel={() => setDeleteId(null)}
          onConfirm={remove}
        />
      </div>
    </main>
  )
}

export default CatalogAdmin