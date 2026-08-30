import React, { useCallback, useEffect, useState } from "react"
import {
  createComponent,
  createInventoryMovement,
  createSupplier,
  deleteComponent,
  deleteSupplier,
  fetchComponents,
  fetchInventoryMovements,
  fetchInventorySummary,
  fetchSuppliers,
  updateComponent,
  updateSupplier,
  Component,
  InventoryMovement,
  InventorySummary,
  Supplier,
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
  Modal,
  ConfirmDialog,
  StateError,
  EmptyState,
  Skeleton,
  useToastAction,
} from "../../components/ui"

const lowTone = (low?: boolean) => (low ? <Badge className="bg-red-100 text-red-800">Low</Badge> : <Badge className="bg-green-100 text-green-800">OK</Badge>)

const Inventory: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<"overview" | "components" | "suppliers" | "movements">("components")
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [components, setComponents] = useState<Component[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [error, setError] = useState<string | null>(null)

  const [componentForm, setComponentForm] = useState(() => ({ sku: "", name: "", category: "", manufacturer: "", model_no: "", unit: "units", current_stock: "", minimum_stock: "", purchase_price: "", selling_price: "", storage_location: "" }))
  const [supplierForm, setSupplierForm] = useState(() => ({ name: "", company: "", contact: "", email: "", phone: "", status: "ACTIVE" }))
  const [movementForm, setMovementForm] = useState(() => ({ component_id: "", movement_type: "IN", quantity: "1", note: "" }))
  const [editing, setEditing] = useState<"component" | "supplier" | null>(null)
  const [compId, setCompId] = useState<number | null>(null)
  const [supId, setSupId] = useState<number | null>(null)
  const [modal, setModal] = useState<null | "component" | "supplier" | "movement">(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    return Promise.all([
      fetchInventorySummary().catch(() => null),
      fetchComponents().catch(() => []),
      fetchSuppliers().catch(() => []),
      fetchInventoryMovements(undefined, 100).catch(() => []),
    ]).then(([s, c, sup, m]) => { setSummary(s); setComponents(c); setSuppliers(sup); setMovements(m); })
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const saveComponent = () => {
    if (!componentForm.sku.trim() || !componentForm.name.trim()) return
    const payload = {
      sku: componentForm.sku.trim(),
      name: componentForm.name.trim(),
      category: componentForm.category || null,
      manufacturer: componentForm.manufacturer || null,
      model_no: componentForm.model_no || null,
      unit: componentForm.unit || "units",
      current_stock: Number(componentForm.current_stock) || 0,
      minimum_stock: Number(componentForm.minimum_stock) || 0,
      purchase_price: Number(componentForm.purchase_price) || 0,
      selling_price: Number(componentForm.selling_price) || 0,
      storage_location: componentForm.storage_location || null,
    } as Partial<Component>
    run(async () => {
      compId ? await updateComponent(compId, payload) : await createComponent(payload)
      setModal(null)
      await load()
    }, { success: "Component saved" })
  }

  const saveSupplier = () => {
    if (!supplierForm.name.trim()) return
    if (!supplierForm.phone.trim()) return
    run(async () => {
      const payload = { ...supplierForm, name: supplierForm.name.trim(), phone: supplierForm.phone.trim() } as Partial<Supplier>
      supId ? await updateSupplier(supId, payload) : await createSupplier(payload)
      setModal(null)
      await load()
    }, { success: "Supplier saved" })
  }

  const recordMovement = () => {
    const cid = Number(movementForm.component_id)
    if (!cid) return
    run(async () => {
      await createInventoryMovement({
        component_id: cid,
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity) || 0,
        note: movementForm.note || null,
      })
      setModal(null)
      await load()
    }, { success: "Movement recorded" })
  }

  const remove = () => {
    if (!deleteId) return
    run(async () => {
      if (tab === "suppliers") await deleteSupplier(deleteId)
      else await deleteComponent(deleteId)
      setDeleteId(null)
      await load()
    }, { success: "Deleted" })
  }

  const summaryCards: { label: string; value: number | string }[] = summary ? [
    { label: "Components", value: summary.components_count },
    { label: "Units in stock", value: summary.total_units_in_stock },
    { label: "Low stock", value: summary.low_stock_count },
    { label: "Inventory value", value: `$${summary.inventory_value.toLocaleString()}` },
    { label: "Suppliers", value: summary.suppliers_count },
  ] : []

  const movementTone: Record<string, string> = { IN: "bg-green-100 text-green-800", OUT: "bg-blue-100 text-blue-800", ADJUST: "bg-amber-100 text-amber-800" }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Inventory" subtitle="Component stock, suppliers and warehouse movements." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!summary ? <Skeleton className="h-24 w-full" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            {summaryCards.map((c) => (
              <div key={c.label} className="bg-white rounded-lg shadow p-4">
                <div className="text-2xl font-bold text-gray-900">{c.value}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <Tabs>
          <TabsList>
            <TabsTrigger active={tab === "components"} onClick={() => setTab("components")}>Components</TabsTrigger>
            <TabsTrigger active={tab === "suppliers"} onClick={() => setTab("suppliers")}>Suppliers</TabsTrigger>
            <TabsTrigger active={tab === "movements"} onClick={() => setTab("movements")}>Movements</TabsTrigger>
          </TabsList>

          <TabsContent active={tab === "components"}>
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="secondary" onClick={() => { setMovementForm((f) => ({ ...f, component_id: compId ? String(compId) : "" })); setModal("movement") }}>+ Record movement</Button>
              <Button onClick={() => { setComponentForm({ sku: "", name: "", category: "", manufacturer: "", model_no: "", unit: "units", current_stock: "0", minimum_stock: "0", purchase_price: "0", selling_price: "0", storage_location: "" }); setCompId(null); setModal("component") }}>+ Add component</Button>
            </div>
            {components.length === 0 ? <EmptyState title="No components yet" /> : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU / Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Prices</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {components.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.sku}</div>
                        </TableCell>
                        <TableCell>{c.category || "—"}</TableCell>
                        <TableCell>
                          {c.current_stock ?? 0} {c.unit || ""}{" "}
                          <span className="ml-1">{lowTone(c.low_stock)}</span>
                          {c.minimum_stock !== undefined && c.minimum_stock > 0 && <div className="text-xs text-gray-400">min {c.minimum_stock}</div>}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>Buy ${(c.purchase_price ?? 0).toLocaleString()}</div>
                          <div>Sell ${(c.selling_price ?? 0).toLocaleString()}</div>
                        </TableCell>
                        <TableCell>{c.status === "ACTIVE" ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-600">{c.status || "Inactive"}</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="secondary" size="sm" className="mr-2" onClick={() => { setComponentForm({ sku: c.sku, name: c.name, category: c.category || "", manufacturer: c.manufacturer || "", model_no: c.model_no || "", unit: c.unit || "units", current_stock: String(c.current_stock ?? 0), minimum_stock: String(c.minimum_stock ?? 0), purchase_price: String(c.purchase_price ?? 0), selling_price: String(c.selling_price ?? 0), storage_location: c.storage_location || "" }); setCompId(c.id); setModal("component") }}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(c.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent active={tab === "suppliers"}>
            <div className="flex justify-end mb-4">
              <Button onClick={() => { setSupplierForm({ name: "", company: "", contact: "", email: "", phone: "", status: "ACTIVE" }); setSupId(null); setModal("supplier") }}>+ Add supplier</Button>
            </div>
            {suppliers.length === 0 ? <EmptyState title="No suppliers yet" /> : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email / Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {suppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
                        <TableCell>{s.contact || s.company || "—"}</TableCell>
                        <TableCell className="text-xs">{s.email || "—"}<br />{s.phone || ""}</TableCell>
                        <TableCell>{s.status === "ACTIVE" ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-600">{s.status || "Inactive"}</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="secondary" size="sm" className="mr-2" onClick={() => { setSupplierForm({ name: s.name, company: s.company || "", contact: s.contact || "", email: s.email || "", phone: s.phone || "", status: s.status || "ACTIVE" }); setSupId(s.id); setModal("supplier") }}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent active={tab === "movements"}>
            {movements.length === 0 ? <EmptyState title="No movements yet" /> : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="font-medium text-gray-900">#{m.component_id}</TableCell>
                        <TableCell><Badge className={movementTone[m.movement_type] || "bg-gray-100 text-gray-600"}>{m.movement_type}</Badge></TableCell>
                        <TableCell className={m.movement_type === "OUT" ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>{m.movement_type === "OUT" ? "-" : "+"}{m.quantity}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">{m.note || m.reference_number || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Modal open={modal === "component"} onClose={() => setModal(null)} title={compId ? "Edit component" : "Add component"}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="csk" required>SKU</Label>
                <Input id="csk" value={componentForm.sku} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cnm" required>Name</Label>
                <Input id="cnm" value={componentForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ccat">Category</Label>
                <Input id="ccat" value={componentForm.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cmfg">Manufacturer</Label>
                <Input id="cmfg" value={componentForm.manufacturer} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cmodel">Model no.</Label>
                <Input id="cmodel" value={componentForm.model_no} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, model_no: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cunit">Unit</Label>
                <Input id="cunit" value={componentForm.unit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, unit: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cstock">Current stock</Label>
                <Input id="cstock" type="number" value={componentForm.current_stock} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, current_stock: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cmin">Min stock</Label>
                <Input id="cmin" type="number" value={componentForm.minimum_stock} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, minimum_stock: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="cbuy">Purchase price</Label>
                <Input id="cbuy" type="number" value={componentForm.purchase_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, purchase_price: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="csell">Selling price</Label>
                <Input id="csell" type="number" value={componentForm.selling_price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, selling_price: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="cloc">Storage location</Label>
              <Input id="cloc" value={componentForm.storage_location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm((f) => ({ ...f, storage_location: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={saveComponent}>{compId ? "Save changes" : "Create"}</Button>
          </div>
        </Modal>

        <Modal open={modal === "supplier"} onClose={() => setModal(null)} title={supId ? "Edit supplier" : "Add supplier"}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="snm" required>Name</Label>
              <Input id="snm" value={supplierForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="scmp">Company</Label>
                <Input id="scmp" value={supplierForm.company} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm((f) => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="scon">Contact</Label>
                <Input id="scon" value={supplierForm.contact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm((f) => ({ ...f, contact: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="seml">Email</Label>
                <Input id="seml" value={supplierForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="sphn" required>Phone</Label>
                <Input id="sphn" value={supplierForm.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={saveSupplier}>{supId ? "Save changes" : "Create"}</Button>
          </div>
        </Modal>

        <Modal open={modal === "movement"} onClose={() => setModal(null)} title="Record movement">
          <div className="space-y-4">
            <div>
              <Label htmlFor="mc" required>Component ID</Label>
              <Input id="mc" type="number" value={movementForm.component_id} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm((f) => ({ ...f, component_id: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="mt" required>Type</Label>
                <select id="mt" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={movementForm.movement_type}
                  onChange={(e) => setMovementForm((f) => ({ ...f, movement_type: e.target.value }))}>
                  <option value="IN">IN (restock)</option>
                  <option value="OUT">OUT (use)</option>
                  <option value="ADJUST">ADJUST</option>
                </select>
              </div>
              <div>
                <Label htmlFor="mq" required>Quantity</Label>
                <Input id="mq" type="number" value={movementForm.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="mn">Note</Label>
              <Input id="mn" value={movementForm.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovementForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={recordMovement}>Record</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteId}
          title="Delete item"
          message="Delete this entry? This cannot be undone."
          destructive
          onCancel={() => setDeleteId(null)}
          onConfirm={remove}
        />
      </div>
      <span className="hidden">{editing}</span>
    </main>
  )
}

export default Inventory