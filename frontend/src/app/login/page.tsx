'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Cloud, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (mounted && user) {
          console.log('[Login] User already authenticated, redirecting:', { userId: user.id })
          const next = searchParams.get('next')
          const redirectPath = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
          router.replace(redirectPath)
          return
        }
      } catch (err) {
        console.error('[Login] Session check error:', err)
        // Network error or misconfigured Supabase keys — fall through to show login
      }
      if (mounted) setCheckingSession(false)
    }

    void checkSession()

    return () => {
      mounted = false
    }
  }, [router, searchParams])

  // Handle OAuth errors from URL parameters
  useEffect(() => {
    const oauthError = searchParams.get('error')
    if (oauthError === 'auth_failed') {
      const reason = searchParams.get('reason')
      const message = reason
        ? `Google login failed: ${decodeURIComponent(reason)}`
        : 'Google login failed. Please try again.'
      setError(message)
    }

    if (searchParams.get('loggedOut') === '1') {
      setError('You have been signed out. Sign in to continue.')
    }
  }, [searchParams])

  const validateForm = () => {
    if (!email.trim()) {
      setError('Please enter your email.')
      return false
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.')
      return false
    }
    if (!password) {
      setError('Please enter your password.')
      return false
    }
    return true
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validateForm()) return

    setEmailLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('[Login] Email auth error:', {
          message: error.message,
          status: error.status,
        })
        
        // Map specific error messages
        let userMessage = 'Invalid email or password.'
        
        if (error.message?.includes('Invalid login credentials')) {
          userMessage = 'Invalid email or password.'
        } else if (error.message?.includes('Email not confirmed')) {
          userMessage = 'Please confirm your email before logging in. Check your inbox for the confirmation link.'
        } else if (error.message?.includes('User not found')) {
          userMessage = 'No account found with this email. Please register first.'
        } else if (error.message?.includes('over_request_rate_limit')) {
          userMessage = 'Too many login attempts. Please try again later.'
        } else {
          userMessage = error.message || userMessage
        }
        
        setError(userMessage)
        setEmailLoading(false)
      } else {
        console.log('[Login] User logged in successfully via email')
        router.replace('/dashboard')
      }
    } catch (err) {
      console.error('[Login] Unexpected error during email login:', err)
      setError('An unexpected error occurred. Please try again.')
      setEmailLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (googleLoading || emailLoading) return
    setError(null)
    setGoogleLoading(true)

    try {
      // Check if Supabase is properly configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration missing - check environment variables')
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        console.error('[Login] Google OAuth error:', {
          message: error.message,
          status: error.status,
        })
        
        // Provide specific guidance for common errors
        let userMessage = error.message || 'Google login failed. Please try again.'
        
        if (error.message?.includes('OAuth') || error.message?.includes('provider')) {
          userMessage = 'Google OAuth not configured in Supabase. Contact administrator.'
        } else if (error.message?.includes('redirect')) {
          userMessage = 'Redirect URI mismatch - verify OAuth settings in Supabase and Google Console.'
        } else if (error.message?.includes('Invalid')) {
          userMessage = 'Invalid OAuth request - refresh page and try again.'
        }
        
        setError(userMessage)
        setGoogleLoading(false)
      }
      // If no error, the redirect happens and this component unmounts
    } catch (err) {
      console.error('[Login] Unexpected error during Google login:', err)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(`Google login error: ${errMsg}`)
      setGoogleLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Left Panel — Dynamic Cloud Visual */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-neutral-950 border-r border-neutral-900 relative overflow-hidden">
        {/* Glow rings */}
        <div className="absolute w-96 h-96 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute w-72 h-72 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute w-48 h-48 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '2s' }} />

        {/* Cloud icon */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="p-8 rounded-full bg-white/5 border border-white/10 shadow-[0_0_80px_rgba(255,255,255,0.08)]">
            <Cloud className="w-24 h-24 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SmartCloud</h1>
          <p className="text-neutral-400 text-center max-w-xs leading-relaxed">
            Your Intelligent Cloud Storage — powered by AI.
          </p>
          <div className="flex gap-2 mt-4">
            {['Files', 'AI Search', 'Collaboration'].map((tag) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <Cloud className="w-12 h-12 mb-3 text-white" />
            <h1 className="text-2xl font-bold">SmartCloud</h1>
            <p className="text-neutral-400 text-sm mt-1">Your Intelligent Cloud Storage</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
            <p className="text-neutral-400 text-sm mb-8">Sign in to your account to continue</p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-950/60 border border-red-800 text-red-300 text-sm rounded-lg flex items-start gap-2">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={emailLoading || googleLoading}
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-neutral-300">Password</label>
                  <Link href="/forgot-password" className="text-xs text-neutral-400 hover:text-white transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={emailLoading || googleLoading}
                    className="w-full pl-10 pr-12 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading || googleLoading}
                className="w-full bg-white hover:bg-neutral-100 text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {emailLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-xs text-neutral-500 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={emailLoading || googleLoading}
              className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Connecting to Google...</>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="mt-8 text-center text-sm text-neutral-500">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-white font-medium hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
