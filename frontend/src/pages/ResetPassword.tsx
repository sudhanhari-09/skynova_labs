import React, { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { resetPassword } from "../services/api"
import { Button, Input, Label } from "../components/ui"

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    if (!token) {
      setError("Missing reset token. Use the link from your email.")
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Reset failed")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-bold text-gray-900">Password updated</h2>
          <p className="text-sm text-gray-500">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-xl font-bold text-gray-900">Choose a new password</h2>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-text">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              type="password"
              id="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              type="password"
              id="confirm"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
              required
            />
          </div>

          <Button type="submit" loading={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </div>
    </main>
  )
}

export default ResetPassword