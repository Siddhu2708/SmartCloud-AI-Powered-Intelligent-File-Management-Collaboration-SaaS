'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Cloud, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
      setTimeout(() => router.replace('/dashboard'), 2500)
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Could not update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
            <Cloud className="h-4 w-4 text-black" />
          </div>
          <span className="text-sm font-bold text-white">SmartCloud</span>
        </div>

        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
            <p className="font-semibold text-white">Password updated!</p>
            <p className="mt-1 text-sm text-neutral-400">Redirecting to your dashboard…</p>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-bold text-white">Set new password</h1>
            <p className="mb-6 text-sm text-neutral-400">Choose a strong password for your account.</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-300">New password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2.5 pl-3 pr-10 text-sm text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-300">Confirm password</label>
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2.5 pl-3 pr-4 text-sm text-white placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
                />
              </div>

              {error && <p className="rounded-lg bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
