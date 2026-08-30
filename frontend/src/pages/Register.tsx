import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../store/authStore"
import Logo from "../components/Logo"

const Register: React.FC = () => {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    if (!phone.trim()) {
      setError("Phone number is required.")
      return
    }
    if (!/^[+]?[\d\s\-().]{7,20}$/.test(phone.trim())) {
      setError("Please enter a valid phone number.")
      return
    }

    setSubmitting(true)
    try {
      await register(email, password, firstName || undefined, lastName || undefined, phone)
      navigate("/", { replace: true })
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo width={48} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Create an account</h1>
          <p className="text-sm text-gray-500 mt-1">Join SkyNova Project Labs</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-text">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="label">
                <span className="label-text">First name</span>
              </label>
              <input
                id="firstName"
                type="text"
                className="input input-bordered w-full"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="label">
                <span className="label-text">Last name</span>
              </label>
              <input
                id="lastName"
                type="text"
                className="input input-bordered w-full"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="label">
              <span className="label-text">Email address *</span>
            </label>
            <input
              id="email"
              type="email"
              className="input input-bordered w-full"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="label">
              <span className="label-text">Phone *</span>
            </label>
            <input
              id="phone"
              type="tel"
              className="input input-bordered w-full"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="password" className="label">
                <span className="label-text">Password *</span>
              </label>
              <input
                id="password"
                type="password"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm" className="label">
                <span className="label-text">Confirm password *</span>
              </label>
              <input
                id="confirm"
                type="password"
                className="input input-bordered w-full"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register