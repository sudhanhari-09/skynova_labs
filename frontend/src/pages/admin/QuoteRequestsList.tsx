import React, { useEffect, useState } from "react"
import { useAuth } from "../../store/authStore"
import { useNavigate } from "react-router-dom"
import { Table, TableHeader, TableRow, TableCell, Spinner, EmptyState } from "../../components/ui"
import { fetchQuoteRequests, QuoteRequest } from "../../services/api"

const QuoteRequestsList: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<QuoteRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await fetchQuoteRequests()
        setRequests(data || [])
      } catch (error) {
        console.error("Failed to load quote requests:", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [isAuthenticated, navigate])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="py-8">
            <Spinner className="mx-auto" />
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <EmptyState
            title="No Quote Requests Found"
            description="Quote requests submitted from the website will appear here."
          />
        )}

        {!isLoading && requests.length > 0 && (
          <div className="overflow-x-auto rounded-lg shadow">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Request #</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHeader>
              {requests.map((r) => (
                <TableRow key={r.id} onClick={() => navigate(`/admin/quote-requests/${r.id}`)} className="cursor-pointer">
                  <TableCell>{r.request_number}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}

export default QuoteRequestsList