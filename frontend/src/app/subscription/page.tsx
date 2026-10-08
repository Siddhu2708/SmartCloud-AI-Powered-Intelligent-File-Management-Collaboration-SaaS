'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Crown,
  Zap,
  ShieldCheck,
  Check,
  HardDrive,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatBytes } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Loading'
import {
  PLANS,
  fetchMyPayments,
  fetchSubscriptionFromBackend,
  type UserSubscription,
  type PaymentRecord,
} from '@/lib/payments'

// ── Storage usage meter ───────────────────────────────────────────────────────

function UsageMeter({
  label,
  used,
  total,
  unit = '',
  color = 'bg-neutral-900 dark:bg-white',
}: {
  label: string
  used: number
  total: number
  unit?: string
  color?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const bar = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : color
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="font-medium text-neutral-900 dark:text-white">
          {unit === 'bytes' ? formatBytes(used) : `${used.toLocaleString()}${unit}`}
          {' / '}
          {total === 0
            ? '∞'
            : unit === 'bytes'
            ? formatBytes(total)
            : `${total.toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-xs ${pct >= 90 ? 'text-red-500' : 'text-neutral-400'}`}>
        {pct}% used
      </p>
    </div>
  )
}

// ── Payment history row ───────────────────────────────────────────────────────

function PaymentRow({ p }: { p: PaymentRecord }) {
  const statusIcon =
    p.payment_status === 'paid' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : p.payment_status === 'failed' ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <Clock className="h-4 w-4 text-amber-500" />
    )

  const amountRupees = (p.amount / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  })

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
      {statusIcon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium capitalize text-neutral-900 dark:text-white">
          {p.plan_name} plan
        </p>
        <p className="text-xs text-neutral-500">
          {new Date(p.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          {p.razorpay_payment_id && (
            <span className="ml-2 font-mono text-[10px] text-neutral-400">
              {p.razorpay_payment_id}
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {amountRupees}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
            p.payment_status === 'paid'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : p.payment_status === 'failed'
              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          }`}
        >
          {p.payment_status}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [storageUsed, setStorageUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Storage — always from Supabase
      const { data: files } = await supabase
        .from('files')
        .select('file_size')
        .eq('owner_id', user.id)
        .eq('is_trashed', false)
      const used = (files ?? []).reduce(
        (acc, f: { file_size: number }) => acc + (f.file_size ?? 0),
        0,
      )
      setStorageUsed(used)

      // Subscription + history — backend first, Supabase fallback
      const [sub, history] = await Promise.all([
        fetchSubscriptionFromBackend().catch(() => null),
        fetchMyPayments().catch(() => [] as PaymentRecord[]),
      ])
      setSubscription(sub)
      setPayments(history)

      // Backend health for upgrade buttons
      try {
        const h = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/health`,
          { signal: AbortSignal.timeout(2000) },
        )
        setBackendOnline(h.ok)
      } catch {
        setBackendOnline(false)
      }
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void loadData() }, [loadData])

  const currentPlan = subscription?.plan ?? 'free'
  const storageLimit = subscription?.storage_limit_bytes ?? 15 * 1024 ** 3
  const aiQuota = subscription?.ai_request_quota ?? 10
  const aiUsed = subscription?.ai_requests_used ?? 0

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <Crown className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Subscription</h1>
            <p className="text-sm text-neutral-500">Manage your plan and SmartCloud limits.</p>
          </div>
        </div>

        {/* ── TEST MODE banner ── */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold text-amber-800 dark:text-amber-300">Razorpay TEST MODE active.</span>{' '}
            <span className="text-amber-700 dark:text-amber-400">
              Use card <strong>4111 1111 1111 1111</strong>, any future expiry, any CVV. No real money charged.
            </span>
          </div>
        </div>

        {/* ── Backend offline ── */}
        {backendOnline === false && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900/50 dark:bg-red-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Payment backend offline</p>
              <p className="mt-0.5 text-red-700 dark:text-red-400">
                Run:{' '}
                <code className="rounded bg-red-100 px-1 dark:bg-red-900/40">
                  cd backend &amp;&amp; venv\Scripts\uvicorn app.main:app --reload --port 8000
                </code>
              </p>
            </div>
          </div>
        )}

        {/* ── Current plan ── */}
        {!loading && (
          <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-neutral-500">Current plan</p>
              <p className="mt-0.5 text-xl font-bold capitalize text-neutral-900 dark:text-white">{currentPlan}</p>
              {subscription?.billing_cycle_end && (
                <p className="text-xs text-neutral-400">
                  Renews {new Date(subscription.billing_cycle_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Active
              </span>
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── Usage ── */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Usage overview</h2>
          </div>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <UsageMeter label="Storage" used={storageUsed} total={storageLimit} unit="bytes" />
              <UsageMeter label="AI requests this month" used={aiUsed} total={aiQuota} unit=" queries" />
            </div>
          )}
        </div>

        {/* ── Plans grid ── */}
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-neutral-400">
            Available plans
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan
              const isFree = plan.key === 'free'
              const planIdx = PLANS.findIndex((p) => p.key === plan.key)
              const currentIdx = PLANS.findIndex((p) => p.key === currentPlan)
              const isDowngrade = !isFree && !isCurrent && currentIdx > planIdx

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-xl border p-5 transition-all ${
                    isCurrent
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black'
                      : plan.highlight
                      ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/10'
                      : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
                  }`}
                >
                  {plan.highlight && !isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className={`text-xs ${isCurrent ? 'opacity-70' : 'text-neutral-400'}`}>{plan.period}</span>
                    </div>
                    <p className={`mt-1 text-sm font-semibold ${isCurrent ? '' : 'text-neutral-900 dark:text-white'}`}>
                      {plan.name}
                    </p>
                    <p className={`mt-0.5 text-xs ${isCurrent ? 'opacity-70' : 'text-neutral-500'}`}>
                      {plan.storage} storage
                    </p>
                  </div>

                  <ul className="flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isCurrent ? 'opacity-70' : 'text-emerald-500'}`} />
                        <span className={`text-xs ${isCurrent ? 'opacity-80' : 'text-neutral-600 dark:text-neutral-400'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* ── CTA — navigates to /payment/[plan] ── */}
                  {isCurrent ? (
                    <div className="mt-5 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold bg-white/10 text-white dark:bg-black/10">
                      Current plan
                    </div>
                  ) : isFree ? (
                    <div className="mt-5 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold border border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800">
                      Free plan
                    </div>
                  ) : isDowngrade ? (
                    <div className="mt-5 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold border border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800">
                      Lower plan
                    </div>
                  ) : (
                    <Link
                      href={`/payment/${plan.key}`}
                      className={`mt-5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                        plan.highlight
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border border-neutral-200 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700'
                      }`}
                    >
                      Upgrade to {plan.name}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Payment history ── */}
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <Receipt className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Payment history</h2>
          </div>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <HardDrive className="mb-3 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm text-neutral-500">No payments yet.</p>
              <p className="mt-1 text-xs text-neutral-400">Your payment history will appear here after your first upgrade.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
            </div>
          )}
        </div>

        {/* ── Security note ── */}
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-950/60">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          <div>
            <p className="font-medium text-neutral-900 dark:text-white">Secure payments</p>
            <p className="mt-1 text-neutral-500">
              Payments processed by Razorpay. SmartCloud never stores your card details.
              Every payment is verified server-side with HMAC-SHA256 before your plan activates.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
