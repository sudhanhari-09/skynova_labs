import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { useParams, useNavigate } from "react-router-dom"
import { Table, TableHeader, TableRow, TableCell, Button, Badge, Spinner, EmptyState, Tabs, Tab, TabsList, TabsTrigger, TabsContent } from "../../components/ui"
import { fetchLeadDetail, fetchTechnicalAnalysis, fetchEstimation, listQuotations, getQuotation, listContracts, getContract } from "../../services/api"

const LeadDetails: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const [lead, setLead] = useState<any>(null)
  const [contact, setContact] = useState<any>(null)
  const [technicalAnalysis, setTechnicalAnalysis] = useState<any>(null)
  const [estimation, setEstimation] = useState<any>(null)
  const [quotations, setQuotations] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    loadLeadDetail()
  }, [isAuthenticated, navigate, leadId])

  const loadLeadDetail = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const id = leadId ? parseInt(leadId, 10) : 0

      // Fetch lead detail
      const leadResponse = await fetchLeadDetail(id)
      const leadData = leadResponse.lead
      setLead(leadData)
      setContact(leadResponse.contact || null)

      if (leadData?.id) {
        // Fetch technical analysis
        const taResponse = await fetchTechnicalAnalysis(id)
        setTechnicalAnalysis(taResponse.technical_analysis)

        // Fetch estimation
        const estResponse = await fetchEstimation(id)
        setEstimation(estResponse.estimation)

        // Fetch quotations
        const qResponse = await listQuotations(undefined, id, 1, 100)
        setQuotations(qResponse.quotations || [])

        // Fetch contracts for this lead only
        const cResponse = await listContracts(undefined, 1, 50, id)
        setContracts(cResponse.contracts || [])
      }

    } catch (err: any) {
      setError(err.message || "Failed to load lead details")
      console.error("Error loading lead details:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!lead || isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {isLoading && (
            <div className="h-96 flex items-center justify-center">
              <Spinner className="mx-auto" />
            </div>
          )}
          {error && (
            <div className="alert alert-error mt-4">
              <span className="alert-text">{error}</span>
            </div>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Lead Header with Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {lead.lead_number} - {lead.status}
              </h2>
              <p className="text-sm text-gray-500">
                {contact?.first_name} {contact?.last_name} | {contact?.email}
              </p>
            </div>
            <div>
              <Badge
                className={
                  ["NEW", "CONTACTED"].includes(lead.status)
                    ? "bg-primary/20 text-primary"
                    : ["QUALIFIED", "REQUIREMENT_COLLECTED"].includes(lead.status)
                    ? "bg-green/20 text-green"
                    : ["TECHNICAL_ANALYSIS", "ESTIMATION"].includes(lead.status)
                    ? "bg-purple/20 text-purple"
                    : ["QUOTATION_PREPARATION", "QUOTATION_SENT", "NEGOTIATION"].includes(lead.status)
                    ? "bg-yellow/20 text-yellow"
                    : lead.status === "WON"
                    ? "bg-green/20 text-green"
                    : lead.status === "LOST"
                    ? "bg-red/20 text-red-800"
                    : "bg-red/20 text-red-800"
                }
              >
                {lead.status}
              </Badge>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Lead Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Lead Number</p>
                  <p className="font-medium">{lead.lead_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <Badge
                    className={
                      lead.priority === "HIGH"
                        ? "bg-red-100 text-red-800"
                        : lead.priority === "URGENT"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {lead.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p className="font-medium">{lead.source || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium">{lead.created_at?.toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Section */}
          {activeTab === "overview" && contact && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Contact Information</h3>
              <p className="text-gray-700">
                <strong>Name:</strong> {contact.first_name} {contact.last_name}
              </p>
              <p className="text-gray-700">
                <strong>Email:</strong> {contact.email}
              </p>
              {contact.phone && (
                <p className="text-gray-700 mt-1">
                  <strong>Phone:</strong> {contact.phone}
                </p>
              )}
              {contact.whatsapp && (
                <p className="text-gray-700 mt-1">
                  <strong>WhatsApp:</strong> {contact.whatsapp}
                </p>
              )}
              {contact.company_name && (
                <p className="text-gray-700 mt-2">
                  <strong>Company:</strong> {contact.company_name}
                </p>
              )}
            </div>
          )}

          {/* Project Request Section */}
          {lead.quote_request && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Project Request</h3>
              <p className="text-gray-600 text-sm">
                <strong>Project Type:</strong> {lead.quote_request.project_type?.name || "—"}
              </p>
              {lead.quote_request?.subcategory && (
                <p className="text-gray-600 text-sm">
                  <strong>Subcategory:</strong> {lead.quote_request.subcategory.name}
                </p>
              )}
              {lead.quote_request?.budget && (
                <p className="text-gray-600 text-sm mt-1">
                  <strong>Budget:</strong> {lead.quote_request.budget}
                </p>
              )}
              {lead.quote_request?.timeline && (
                <p className="text-gray-600 text-sm mt-1">
                  <strong>Timeline:</strong> {lead.quote_request.timeline}
                </p>
              )}
            </div>
          )}

          {/* Technical Analysis Tab */}
          {activeTab === "technical-analysis" && technicalAnalysis && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Technical Analysis</h3>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Business Requirement</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.business_requirement || "—"}</p>
                <p className="text-sm text-gray-500">Technical Requirement</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.technical_requirement || "—"}</p>
                <p className="text-sm text-gray-500">Proposed Solution</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.proposed_solution || "—"}</p>
                <p className="text-sm text-gray-500">Architecture Notes</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.architecture_notes || "—"}</p>
                <p className="text-sm text-gray-500">Technologies</p>
                <p className="text-gray-300 whitespace-pre-wrap">
                  {technicalAnalysis.technologies && technicalAnalysis.technologies.length > 0
                    ? technicalAnalysis.technologies.join(", ")
                    : "—"}
                </p>
                <p className="text-sm text-gray-500">Security Requirements</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.security_requirements || "—"}</p>
                <p className="text-sm text-gray-500">Assumptions</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.assumptions || "—"}</p>
                <p className="text-sm text-gray-500">Risks</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.risks || "—"}</p>
                <p className="text-sm text-gray-500">Constraints</p>
                <p className="text-gray-300 whitespace-pre-wrap">{technicalAnalysis.constraints || "—"}</p>
              </div>
            </div>
          )}

          {/* Estimation Tab */}
          {activeTab === "estimation" && estimation && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Estimation</h3>
              <Badge
                className={
                  estimation.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : estimation.status === "DRAFT"
                    ? "bg-yellow-100 text-yellow-800"
                    : estimation.status === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }
              >
                {estimation.status}
              </Badge>
              {estimation.assumptions && (
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  <strong>Assumptions:</strong> {estimation.assumptions}
                </p>
              )}
              {estimation.notes && (
                <p className="text-sm text-gray-500 mt-1 mb-2">
                  <strong>Notes:</strong> {estimation.notes}
                </p>
              )}
            </div>
          )}

          {/* Quotations Tab */}
          {activeTab === "quotations" && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Quotations ({quotations.length})</h3>
              {quotations.length > 0 && (
                <div className="space-y-2">
                  {quotations.map((q: any) => (
                    <div key={q.id} className="px-3 py-2 rounded-md bg-gray-50 text-xs">
                      <div className="font-medium">{q.quotation_number}</div>
                      <div className="text-xs text-gray-500">
                        v{q.version} | {q.status}
                      </div>
                      <div className="mt-1 text-green-600">
                        Total: ${q.total || 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {quotations.length === 0 && (
                <p className="text-xs text-gray-500">No quotations</p>
              )}
            </div>
          )}

          {/* Contracts Tab */}
          {activeTab === "contracts" && (
            <div className="mb-6">
              <h3 className="text font-medium text-gray-500 mb-2">Contracts ({contracts.length})</h3>
              {contracts.length > 0 && (
                <div className="space-y-2">
                  {contracts.map((c: any) => (
                    <div key={c.id} className="px-3 py-2 rounded-md bg-gray-50 text-xs">
                      <div className="font-medium">{c.contract_number}</div>
                      <div className="text-xs text-gray-500">
                        v{c.version} | {c.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {contracts.length === 0 && (
                <p className="text-xs text-gray-500">No contracts</p>
              )}
            </div>
          )}

          {/* Activities Timeline */}
          <div>
            <h3 className="text font-medium text-gray-500 mb-3">Activity Timeline</h3>
            {/* Activities would be rendered here */}
            {isLoading && (
              <div className="h-40 flex items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="technical-analysis">Technical Analysis</TabsTrigger>
            <TabsTrigger value="estimation">Estimation</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            {/* Overview content already rendered above */}
          </TabsContent>
          <TabsContent value="technical-analysis">
            {/* Technical Analysis content already rendered above */}
          </TabsContent>
          <TabsContent value="estimation">
            {/* Estimation content already rendered above */}
          </TabsContent>
          <TabsContent value="quotations">
            {/* Quotations content already rendered above */}
          </TabsContent>
          <TabsContent value="contracts">
            {/* Contracts content already rendered above */}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

export default LeadDetails