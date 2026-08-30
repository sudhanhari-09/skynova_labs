import React, { useState } from "react"
import { Link } from "react-router-dom"
import { forgotPassword } from "../services/api"
import { Button, Input, Label } from "../components/ui"

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await forgotPassword(email)
      setNotice(res.detail || "If that email is registered, a reset link has been sent.")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-xl font-bold text-gray-900">Reset your password</h2>
          <p className="text-sm text-gray-500 mt-2">
            Enter your account email and we'll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-text">{error}</span>
          </div>
        )}
        {notice && (
          <div className="alert alert-success">
            <span className="alert-text">{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              type="email"
              id="email"
              placeholder="name@projectlabs.com"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button type="submit" loading={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Remembered it?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}

export default ForgotPassword