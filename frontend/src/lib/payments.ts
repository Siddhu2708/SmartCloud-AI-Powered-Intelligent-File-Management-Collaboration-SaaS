/**
 * SmartCloud payments helper — Razorpay TEST MODE
 *
 * All calls go to the FastAPI backend at NEXT_PUBLIC_API_URL (default:
 * http://localhost:8000).  The backend holds RAZORPAY_KEY_SECRET; this
 * file never touches it.
 *
 * SWITCHING TO LIVE MODE:
 *   1. Replace RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in backend/.env with
 *      your live keys from https://dashboard.razorpay.com
 *   2. Remove the test-mode notice from the subscription page UI.
 *   3. No changes needed in this file.
 */

import { supabase } from './supabase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Plan definitions (display only — prices are enforced server-side) ─────────

export interface Plan {
  key: 'free' | 'basic' | 'pro' | 'enterprise'
  name: string
  price: string           // display string e.g. "₹299"
  period: string
  storage: string
  storageBytes: number
  aiQuota: number | 'unlimited'
  features: string[]
  highlight?: boolean
  color: string
}

export const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    storage: '15 GB',
    storageBytes: 15 * 1024 ** 3,
    aiQuota: 10,
    color: 'text-neutral-700 dark:text-neutral-300',
    features: [
      '15 GB storage',
      'Basic file sharing',
      '10 AI queries / month',
      'Standard upload speed',
      'Web access',
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    price: '₹299',
    period: '/month',
    storage: '50 GB',
    storageBytes: 50 * 1024 ** 3,
    aiQuota: 50,
    color: 'text-emerald-700 dark:text-emerald-300',
    features: [
      '50 GB storage',
      'Advanced sharing',
      '50 AI queries / month',
      'Priority upload speed',
      'Folder sharing',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '₹899',
    period: '/month',
    storage: '100 GB',
    storageBytes: 100 * 1024 ** 3,
    aiQuota: 200,
    highlight: true,
    color: 'text-blue-700 dark:text-blue-300',
    features: [
      '100 GB storage',
      'Expiring share links',
      '200 AI queries / month',
      'Semantic search',
      'RAG document Q&A',
      'Smart Organize',
      'Priority support',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '₹2,899',
    period: '/month',
    storage: '1 TB',
    storageBytes: 1024 ** 4,
    aiQuota: 'unlimited',
    color: 'text-violet-700 dark:text-violet-300',
    features: [
      '1 TB storage',
      'Team collaboration',
      'Unlimited AI queries',
      'Advanced audit logs',
      'Admin controls',
      'Dedicated support',
    ],
  },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CreateOrderResponse {
  order_id: string
  amount: number        // in paise
  currency: string
  key_id: string        // Razorpay public key
  plan: string
  plan_display_name: string
}

export interface PaymentRecord {
  id: string
  plan_name: string
  amount: number
  currency: string
  razorpay_order_id: string
  razorpay_payment_id: string | null
  payment_status: string
  subscription_status: string
  created_at: string
}

export interface UserSubscription {
  user_id: string
  plan: string
  storage_limit_bytes: number
  ai_request_quota: number
  ai_requests_used: number
  billing_cycle_start: string | null
  billing_cycle_end: string | null
}

// ── Auth helper ────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}` }
}

// ── API calls ──────────────────────────────────────────────────────────────────

/**
 * Ask the backend to create a Razorpay order for the given plan.
 * The backend determines the price — the frontend only sends the plan key.
 */
export async function createOrder(planKey: string): Promise<CreateOrderResponse> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ plan: planKey }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Failed to create order')
  }
  return res.json() as Promise<CreateOrderResponse>
}

/**
 * Send payment result to the backend for HMAC signature verification.
 * The backend verifies the signature with the secret key and only then
 * activates the subscription. Never upgrade the plan on a frontend-only check.
 */
export async function verifyPayment(payload: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  plan: string
}): Promise<{ success: boolean; message: string; plan: string; plan_display_name?: string }> {
  const headers = await getAuthHeader()
  const res = await fetch(`${API_BASE}/api/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Payment verification failed')
  }
  return res.json()
}

/** 
 * Fetch the authenticated user's payment history.
 * Tries the backend first; falls back to Supabase direct read if offline.
 */
export async function fetchMyPayments(): Promise<PaymentRecord[]> {
  // ── Try backend first ────────────────────────────────────────────────────
  try {
    const headers = await getAuthHeader()
    const res = await fetch(`${API_BASE}/api/payments/my-payments`, {
      headers,
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      const data = await res.json() as { payments: PaymentRecord[] }
      return data.payments ?? []
    }
  } catch {
    // Backend offline — fall through to Supabase direct
  }

  // ── Supabase-direct fallback ─────────────────────────────────────────────
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return (data ?? []) as PaymentRecord[]
  } catch {
    return []
  }
}

/** 
 * Fetch the authenticated user's current subscription.
 * Tries the backend first (server-verified). If the backend is offline,
 * falls back to reading user_subscriptions directly from Supabase so the
 * subscription page always shows real data even without the FastAPI server.
 */
export async function fetchSubscriptionFromBackend(): Promise<UserSubscription | null> {
  // ── Try backend first ────────────────────────────────────────────────────
  try {
    const headers = await getAuthHeader()
    const res = await fetch(`${API_BASE}/api/subscription`, {
      headers,
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) return res.json() as Promise<UserSubscription>
  } catch {
    // Backend offline or timed out — fall through to Supabase direct
  }

  // ── Supabase-direct fallback ─────────────────────────────────────────────
  // Reads the user_subscriptions table directly when the backend is unavailable.
  // All data is filtered by auth.uid() via Supabase RLS — no cross-user leakage.
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) {
      return {
        user_id: data.user_id,
        plan: data.plan ?? 'free',
        storage_limit_bytes: data.storage_limit_bytes ?? 15 * 1024 ** 3,
        ai_request_quota: data.ai_request_quota ?? 10,
        ai_requests_used: data.ai_requests_used ?? 0,
        billing_cycle_start: data.billing_cycle_start ?? null,
        billing_cycle_end: data.billing_cycle_end ?? null,
      }
    }

    // No subscription row yet — return free plan defaults
    return {
      user_id: user.id,
      plan: 'free',
      storage_limit_bytes: 15 * 1024 ** 3,
      ai_request_quota: 10,
      ai_requests_used: 0,
      billing_cycle_start: null,
      billing_cycle_end: null,
    }
  } catch {
    return null
  }
}

// ── Razorpay Checkout popup ───────────────────────────────────────────────────

declare global {
  interface Window {
    // Razorpay is loaded via a <script> tag at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

/** Dynamically load the Razorpay Checkout script (idempotent). */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return }
    // Remove any previously failed script tag before retrying
    const old = document.querySelector('script[src*="checkout.razorpay.com"]')
    if (old) old.remove()

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    // Timeout: if the script hasn't loaded in 10 s, reject
    const timeout = setTimeout(() => {
      script.remove()
      reject(new Error('Payment service could not be loaded. Please check your connection and try again.'))
    }, 10000)
    script.onload = () => { clearTimeout(timeout); resolve() }
    script.onerror = () => {
      clearTimeout(timeout)
      script.remove()
      reject(new Error('Payment service could not be loaded. Please check your connection and try again.'))
    }
    document.body.appendChild(script)
  })
}

export interface CheckoutCallbacks {
  onSuccess: (data: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  onDismiss?: () => void
  onError?: (err: Error) => void
}

/**
 * Open the Razorpay Checkout popup.
 *
 * @param order   - Response from createOrder()
 * @param user    - Display name + email for the prefill block
 * @param callbacks - Success / dismiss / error callbacks
 */
export async function openRazorpayCheckout(
  order: CreateOrderResponse,
  user: { name: string; email: string },
  callbacks: CheckoutCallbacks,
): Promise<void> {
  await loadRazorpayScript()

  const options: Record<string, unknown> = {
    // ── TEST MODE — replace key_id with live key to go live ──
    key: order.key_id,
    amount: order.amount,          // paise
    currency: order.currency,
    name: 'SmartCloud',
    description: `Upgrade to ${order.plan_display_name}`,
    image: '/favicon.ico',
    order_id: order.order_id,
    prefill: {
      name: user.name,
      email: user.email,
    },
    theme: { color: '#171717' },
    modal: {
      ondismiss: () => {
        callbacks.onDismiss?.()
      },
    },
    handler: (response: {
      razorpay_order_id: string
      razorpay_payment_id: string
      razorpay_signature: string
    }) => {
      callbacks.onSuccess(response)
    },
  }

  const rzp = new window.Razorpay(options)
  rzp.open()
}
