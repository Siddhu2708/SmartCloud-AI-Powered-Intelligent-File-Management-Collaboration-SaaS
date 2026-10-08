'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cloud, Mail, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-black text-white items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Cloud className="w-12 h-12 mb-3 text-white" />
          <h1 className="text-2xl font-bold">SmartCloud</h1>
          <p className="text-neutral-400 text-sm mt-1">Your Intelligent Cloud Storage</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-5" />
              <h2 className="text-xl font-bold mb-3">Check your inbox</h2>
              <p className="text-neutral-400 text-sm mb-8">
                We sent a password reset link to{' '}
                <span className="text-white font-medium">{email}</span>.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">Forgot password?</h2>
              <p className="text-neutral-400 text-sm mb-8">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              {error && (
                <div className="mb-6 px-4 py-3 bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-lg flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white hover:bg-neutral-100 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
