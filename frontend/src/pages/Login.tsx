import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../store/authStore"
import { Button, Input, Label } from "../components/ui"
import Logo from "../components/Logo"

const ADMIN_EMAIL = "hariharasudhan.s@care.ac.in"

const Login: React.FC = () => {
  const { login, isLoading, loginStatus } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        navigate("/admin", { replace: true })
      } else {
        navigate("/user-panel", { replace: true })
      }
    } catch (err: any) {
      setError(err.message || "Login failed")
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo width={48} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Sign in</h2>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-text">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="label">
              <span className="label-text">Email address</span>
            </label>
            <input
              type="email"
              id="email"
              placeholder="name@projectlabs.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input input-bordered w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">
                <span className="label-text">Password</span>
              </label>
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              id="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input input-bordered w-full"
            />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  )
}

export default Login