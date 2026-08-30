import React from "react"
import { useAuth } from "../store/authStore"
import { Link, useNavigate } from "react-router-dom"
import Logo from "../components/Logo"

const ADMIN_EMAIL = "hariharasudhan.s@care.ac.in"

const UserPanel: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo width={32} />
            <h1 className="text-lg font-bold text-gray-900">Project Labs</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.email}
            </span>
            {isAdmin && (
              <Link to="/admin" className="btn-primary text-sm">
                Admin Panel
              </Link>
            )}
            <button onClick={() => { logout(); navigate("/"); }} className="btn-link text-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Welcome back{user?.first_name ? `, ${user.first_name}` : ""}</h2>
          <p className="text-gray-500 mt-1">Here's an overview of your account.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{user?.email}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">Role</p>
            <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">{user?.role || "User"}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm font-medium text-gray-500">Status</p>
            <p className="text-lg font-semibold text-green-600 mt-1">{user?.is_active ? "Active" : "Inactive"}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/projects" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors">
              <p className="font-medium text-gray-900">Projects</p>
              <p className="text-sm text-gray-500 mt-1">View project catalog</p>
            </Link>
            <Link to="/quote" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors">
              <p className="font-medium text-gray-900">Get a Quote</p>
              <p className="text-sm text-gray-500 mt-1">Request a project quote</p>
            </Link>
            <Link to="/solutions" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors">
              <p className="font-medium text-gray-900">Solutions</p>
              <p className="text-sm text-gray-500 mt-1">Explore our solutions</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default UserPanel
