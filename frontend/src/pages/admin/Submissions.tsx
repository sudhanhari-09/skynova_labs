import React, { useCallback, useEffect, useState } from "react"
import {
  convertSubmission,
  fetchNewsletterSubscribers,
  fetchSubmissions,
  NewsletterSubscriber,
  PublicSubmission,
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
  StateError,
  EmptyState,
  useToastAction,
} from "../../components/ui"

const fmt = (s?: string | null) => s || "—"

const Submissions: React.FC = () => {
  const run = useToastAction()
  const [tab, setTab] = useState<"submissions" | "newsletter">("submissions")
  const [subs, setSubs] = useState<PublicSubmission[]>([])
  const [news, setNews] = useState<NewsletterSubscriber[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    return Promise.all([fetchSubmissions().catch(() => []), fetchNewsletterSubscribers().catch(() => [])]).then(([s, n]) => {
      setSubs(s)
      setNews(n)
    })
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  const formTypeBadge = (t: string) => {
    const tones: Record<string, string> = {
      contact: "bg-blue-100 text-blue-800",
      start_project: "bg-blue-100 text-blue-800",
      collaboration: "bg-purple-100 text-purple-800",
      project_submission: "bg-teal-100 text-teal-800",
    }
    return <Badge className={tones[t.replace(/-/g, "_")] || "bg-gray-100 text-gray-600"}>{t}</Badge>
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader title="Public Forms" subtitle="Submissions from the contact, start-a-project, collaboration and newsletter forms." />

        {error && <StateError message={error} onRetry={() => load()} />}

        {!error && (
          <Tabs>
            <TabsList>
              <TabsTrigger active={tab === "submissions"} onClick={() => setTab("submissions")}>Submissions ({subs.length})</TabsTrigger>
              <TabsTrigger active={tab === "newsletter"} onClick={() => setTab("newsletter")}>Newsletter ({news.length})</TabsTrigger>
            </TabsList>

            <TabsContent active={tab === "submissions"}>
              {subs.length === 0 ? (
                <EmptyState title="No submissions yet" description="Public form submissions will appear here." />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Converted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {subs.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{formTypeBadge(s.form_type)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-gray-900">{fmt(s.name)}</div>
                            <div className="text-xs text-gray-500">{fmt(s.email)}</div>
                          </TableCell>
                          <TableCell>{fmt(s.company)}</TableCell>
                          <TableCell className="max-w-xs truncate">{fmt(s.message)}</TableCell>
                          <TableCell>{s.converted_lead_id ? <Badge className="bg-green-100 text-green-800">#{s.converted_lead_id}</Badge> : <span className="text-xs text-gray-400">—</span>}</TableCell>
                          <TableCell className="text-right">
                            {!s.converted_lead_id && (
                              <Button variant="secondary" size="sm"
                                onClick={() => run(async () => { await convertSubmission(s.id); await load() }, { success: "Converted to lead" })}>
                                Convert
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent active={tab === "newsletter"}>
              {news.length === 0 ? (
                <EmptyState title="No subscribers yet" />
              ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Subscribed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <tbody>
                      {news.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium text-gray-900">{n.email}</TableCell>
                          <TableCell>{fmt(n.name)}</TableCell>
                          <TableCell>{fmt(n.source)}</TableCell>
                          <TableCell>{n.is_active ? <Badge className="bg-green-100 text-green-800">Yes</Badge> : <Badge className="bg-gray-100 text-gray-600">No</Badge>}</TableCell>
                          <TableCell>{n.subscribed_at ? new Date(n.subscribed_at).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  )
}

export default Submissions