import React from "react"
import { Link } from "react-router-dom"

const NotFound = () => {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-10 text-center">
        <div className="text-5xl font-bold text-gray-900 mb-3">404</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-6">
          The page you are looking for does not exist.
        </p>
        <Link to="/" className="btn-primary inline-block">Back to Home</Link>
      </div>
    </main>
  )
}

export default NotFound