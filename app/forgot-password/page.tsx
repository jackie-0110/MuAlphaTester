"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "../../utils/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess("")
    setError("")
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setSuccess("Password reset email sent! Please check your inbox.")
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Forgot Password?</h1>
        <p className="text-gray-600 mb-6 text-center">Enter your email and we'll send you a link to reset your password.</p>
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-4 text-center">{success}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-4 text-center">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !email}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
} 