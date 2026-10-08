'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Cloud, Mail, Lock, User, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (mounted && user) {
          console.log('[Register] User already logged in, redirecting:', { userId: user.id })
          router.replace('/dashboard')
          return
        }
      } catch (err) {
        console.error('[Register] Session check error:', err)
        // Network error or misconfigured Supabase keys — fall through to show register form
      }
      if (mounted) setCheckingSession(false)
    }
    
    void checkSession()

    return () => {
      mounted = false
    }
  }, [router])

  const validate = () => {
    if (!name.trim()) { setError('Please enter your name.'); return false }
    if (!email.trim()) { setError('Please enter your email.'); return false }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email address.'); return false }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return false }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return false }
    return true
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })

    if (error) {
      // Map Supabase errors to user-friendly messages
      let userMessage = error.message
      
      if (error.message?.includes('already registered')) {
        userMessage = 'This email is already registered. Try logging in instead.'
      } else if (error.message?.includes('Invalid email')) {
        userMessage = 'Please enter a valid email address.'
      } else if (error.message?.includes('password')) {
        userMessage = 'Password must be at least 6 characters.'
      } else if (error.message?.includes('over_email_send_rate_limit')) {
        userMessage = 'Too many signup attempts. Please try again later.'
      }
      
      console.error('[Register] Signup error:', {
        message: error.message,
        status: error.status,
      })
      setError(userMessage)
      setLoading(false)
      return
    }

    // If user created but email confirmation required
    if (data.user && !data.session) {
      console.log('[Register] User created, email confirmation required:', { userId: data.user.id })
      setSuccess(true)
      setLoading(false)
    } else if (data.session) {
      // Auto-confirmed, user is logged in
      console.log('[Register] User registered and auto-confirmed:', { userId: data.user?.id })
      router.replace('/dashboard')
    } else {
      // Unexpected state
      console.warn('[Register] Unexpected signup response:', { data })
      setError('Signup failed. Please try again.')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-3">Check your email</h2>
          <p className="text-neutral-400 mb-6">
            We sent a confirmation link to <span className="text-white font-medium">{email}</span>.
            Please confirm your email to activate your account.
          </p>
          <Link href="/login" className="inline-block bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-neutral-200 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-neutral-950 border-r border-neutral-900 relative overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute w-72 h-72 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute w-48 h-48 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="p-8 rounded-full bg-white/5 border border-white/10 shadow-[0_0_80px_rgba(255,255,255,0.08)]">
            <Cloud className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SmartCloud</h1>
          <p className="text-neutral-400 text-center max-w-xs leading-relaxed">
            Join thousands of users storing smarter with AI.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <Cloud className="w-12 h-12 mb-3 text-white" />
            <h1 className="text-2xl font-bold">SmartCloud</h1>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-1">Create account</h2>
            <p className="text-neutral-400 text-sm mb-8">Start your intelligent cloud journey</p>

            {error && (
              <div className="mb-6 px-4 py-3 bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-lg flex items-start gap-2">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
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

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    disabled={loading}
                    className="w-full pl-10 pr-12 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full pl-10 pr-12 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white hover:bg-neutral-100 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-neutral-500">
              Already have an account?{' '}
              <Link href="/login" className="text-white font-medium hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
