import React, { useCallback, useEffect, useState } from "react"
import {
  activateTheme,
  createNavItem,
  createTheme,
  deleteNavItem,
  deleteTheme,
  deleteWebsiteSetting,
  fetchAdminNav,
  fetchThemes,
  fetchWebsiteSettings,
  NavItem,
  Theme,
  upsertWebsiteSetting,
  WebsiteSetting,
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
  Select,
  Label,
  Textarea,
  Modal,
  ConfirmDialog,
  StateError,
  EmptyState,
  useToastAction,
} from "../../components/ui"

interface FormState {
  key: string
  value: string
  value_type: string
  description: string
  is_public: boolean
}

const emptySetting: FormState = { key: "", value: "", value_type: "string", description: "", is_public: false }

const WebsiteSettings: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState("settings")
  const [settings, setSettings] = useState<WebsiteSetting[]>([])
  const [themes, setThemes] = useState<Theme[]>([])
  const [nav, setNav] = useState<NavItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const [settingForm, setSettingForm] = useState<FormState>(emptySetting)
  const [settingModal, setSettingModal] = useState(false)
  const [editingKey, setEditingKey] = useState(false)

  const [themeName, setThemeName] = useState("")
  const [themeModal, setThemeModal] = useState(false)
  const [deleteThemeId, setDeleteThemeId] = useState<number | null>(null)

  const [navForm, setNavForm] = useState<{ label: string; url: string; location: string; display_order: number; is_published: boolean }>({
    label: "", url: "", location: "header", display_order: 0, is_published: true,
  })
  const [navModal, setNavModal] = useState(false)
  const [deleteNavId, setDeleteNavId] = useState<number | null>(null)
  const [deleteSettingKey, setDeleteSettingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, t, n] = await Promise.all([
      fetchWebsiteSettings().catch(() => []),
      fetchThemes().catch(() => []),
      fetchAdminNav().catch(() => []),
    ])
    setSettings(s)
    setThemes(t)
    setNav(n)
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const saveSetting = () => {
    run(async () => {
      await upsertWebsiteSetting({
        key: settingForm.key,
        value_type: settingForm.value_type,
        value_text: settingForm.value_type === "json" ? null : settingForm.value,
        value_json: settingForm.value_type === "json" ? settingForm.value : null,
        description: settingForm.description || null,
        is_public: settingForm.is_public,
      })
      setSettingModal(false)
      await load()
    }, { success: "Setting saved" })
  }

  const saveTheme = () => {
    if (!themeName.trim()) return
    run(async () => {
      await createTheme({ name: themeName.trim(), appearance: "light" })
      setThemeModal(false)
      setThemeName("")
      await load()
    }, { success: "Theme created" })
  }

  const saveNav = () => {
    if (!navForm.label.trim() || !navForm.url.trim()) return
    run(async () => {
      await createNavItem({ ...navForm })
      setNavModal(false)
      setNavForm({ label: "", url: "", location: "header", display_order: 0, is_published: true })
      await load()
    }, { success: "Navigation item created" })
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader
          title="Website"
          subtitle="Site settings, themes and navigation — served to the public site."
        />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (
          <Tabs>
            <TabsList>
              <TabsTrigger active={tab === "settings"} onClick={() => setTab("settings")}>Settings</TabsTrigger>
              <TabsTrigger active={tab === "themes"} onClick={() => setTab("themes")}>Themes</TabsTrigger>
              <TabsTrigger active={tab === "navigation"} onClick={() => setTab("navigation")}>Navigation</TabsTrigger>
            </TabsList>

            {/* Settings */}
            <TabsContent active={tab === "settings"}>
              <div className="flex justify-end mb-4">
                <Button onClick={() => { setSettingForm(emptySetting); setEditingKey(false); setSettingModal(true) }}>
                  + Add setting
                </Button>
              </div>
              {settings.length === 0 ? (
                <EmptyState title="No settings yet" description="Add public branding or hero settings, e.g. brand_name, hero_title." />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {settings.map((s) => (
                        <TableRow key={s.key}>
                          <TableCell className="font-medium text-gray-900">{s.key}</TableCell>
                          <TableCell className="max-w-md truncate">{JSON.stringify(s.value)}</TableCell>
                          <TableCell><Badge>{s.value_type}</Badge></TableCell>
                          <TableCell>{s.description || <span className="text-xs text-gray-400">—</span>}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="secondary" size="sm" className="mr-2" onClick={() => { setSettingForm({ key: s.key, value: String(s.value ?? ""), value_type: s.value_type || "string", description: s.description || "", is_public: s.is_public ?? false }); setEditingKey(true); setSettingModal(true) }}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteSettingKey(s.key)}>Delete</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Themes */}
            <TabsContent active={tab === "themes"}>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setThemeModal(true)}>+ New theme</Button>
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Appearance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {themes.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium text-gray-900">{t.name}</TableCell>
                        <TableCell>{t.appearance || "light"}</TableCell>
                        <TableCell>{t.is_active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>}</TableCell>
                        <TableCell className="text-right">
                          {!t.is_active && (
                            <Button variant="secondary" size="sm" className="mr-2" onClick={() => run(async () => { await activateTheme(t.id); await load() }, { success: "Theme activated" })}>
                              Activate
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" disabled={t.is_active} onClick={() => setDeleteThemeId(t.id)}>Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            </TabsContent>

            {/* Navigation */}
            <TabsContent active={tab === "navigation"}>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setNavModal(true)}>+ Add item</Button>
              </div>
              {nav.length === 0 ? (
                <EmptyState title="No navigation items" description="Add header links to drive the public site navigation." />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {nav.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium text-gray-900">{n.label}</TableCell>
                          <TableCell className="text-blue-600">{n.url}</TableCell>
                          <TableCell>{n.location}</TableCell>
                          <TableCell>{n.display_order}</TableCell>
                          <TableCell>{n.is_published ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge className="bg-gray-100 text-gray-600">No</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteNavId(n.id)}>Delete</Button>
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

        {/* Setting modal */}
        <Modal open={settingModal} onClose={() => setSettingModal(false)} title="Website setting">
          <div className="space-y-4">
            <div>
              <Label htmlFor="key" required>Key</Label>
              <Input id="key" value={settingForm.key} disabled={editingKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingForm((f) => ({ ...f, key: e.target.value }))} placeholder="brand_name" />
            </div>
            <div>
              <Label htmlFor="vtype">Value type</Label>
              <Select id="vtype" value={settingForm.value_type} onChange={(e: any) => setSettingForm((f) => ({ ...f, value_type: e.target.value }))}>
                <option value="string">string</option>
                <option value="bool">boolean</option>
                <option value="int">integer</option>
                <option value="json">json</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="value">Value</Label>
              {settingForm.value_type === "json" ? (
                <Textarea id="value" rows={4} value={settingForm.value} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSettingForm((f) => ({ ...f, value: e.target.value }))} placeholder='{"key": "value"}' />
              ) : (
                <Input id="value" value={settingForm.value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingForm((f) => ({ ...f, value: e.target.value }))} />
              )}
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={settingForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettingForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={settingForm.is_public}
                onChange={(e) => setSettingForm((f) => ({ ...f, is_public: e.target.checked }))} />
              Expose on public site
            </label>
            <Button className="w-full" onClick={saveSetting}>Save setting</Button>
          </div>
        </Modal>

        {/* Theme modal */}
        <Modal open={themeModal} onClose={() => setThemeModal(false)} title="New theme">
          <div className="space-y-4">
            <div>
              <Label htmlFor="tname" required>Theme name</Label>
              <Input id="tname" value={themeName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThemeName(e.target.value)} placeholder="SkyNova Light" />
            </div>
            <Button className="w-full" onClick={saveTheme}>Create theme</Button>
          </div>
        </Modal>

        {/* Nav modal */}
        <Modal open={navModal} onClose={() => setNavModal(false)} title="Navigation item">
          <div className="space-y-4">
            <div>
              <Label htmlFor="nlabel" required>Label</Label>
              <Input id="nlabel" value={navForm.label} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNavForm((f) => ({ ...f, label: e.target.value }))} placeholder="Projects" />
            </div>
            <div>
              <Label htmlFor="nurl" required>URL</Label>
              <Input id="nurl" value={navForm.url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNavForm((f) => ({ ...f, url: e.target.value }))} placeholder="/projects" />
            </div>
            <div>
              <Label>Location</Label>
              <Select value={navForm.location} onChange={(e: any) => setNavForm((f) => ({ ...f, location: e.target.value }))}>
                <option value="header">header</option>
                <option value="footer">footer</option>
              </Select>
            </div>
            <Button className="w-full" onClick={saveNav}>Add item</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={!!deleteThemeId}
          title="Delete theme"
          message="Delete this theme? The active theme cannot be removed."
          destructive
          onCancel={() => setDeleteThemeId(null)}
          onConfirm={() => run(async () => { if (deleteThemeId) await deleteTheme(deleteThemeId); setDeleteThemeId(null); await load() }, { success: "Theme deleted" })}
        />
        <ConfirmDialog
          open={!!deleteNavId}
          title="Delete navigation item"
          message="Remove this item from the navigation?"
          destructive
          onCancel={() => setDeleteNavId(null)}
          onConfirm={() => run(async () => { if (deleteNavId) await deleteNavItem(deleteNavId); setDeleteNavId(null); await load() }, { success: "Navigation item deleted" })}
        />
        <ConfirmDialog
          open={!!deleteSettingKey}
          title="Delete setting"
          message="Delete this website setting?"
          destructive
          onCancel={() => setDeleteSettingKey(null)}
          onConfirm={() => run(async () => { if (deleteSettingKey) await deleteWebsiteSetting(deleteSettingKey); setDeleteSettingKey(null); await load() }, { success: "Setting deleted" })}
        />
      </div>
    </main>
  )
}

export default WebsiteSettings