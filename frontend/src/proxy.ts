/**
 * SmartCloud — Next.js proxy (replaces middleware.ts in Next.js 16+)
 *
 * Responsibilities:
 *  1. Redirect unauthenticated users away from protected routes → /login
 *  2. Redirect already-authenticated users away from /login and /register → /dashboard
 *  3. Pass everything else through unchanged
 *
 * Security notes:
 *  - Uses createServerClient from @supabase/ssr which validates the JWT
 *    server-side on every request — not just a local cookie read.
 *  - On any error (network down, bad keys, timeout) we FAIL OPEN for
 *    protected routes: let the request through and allow the page's own
 *    client-side auth guard to handle it. This prevents a Supabase outage
 *    from locking every user out of the app.
 *  - We never expose the anon key — it's already public by design.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated session
const PROTECTED_PATHS = [
  '/dashboard',
  '/drive',
  '/shared',
  '/recent',
  '/starred',
  '/trash',
  '/ai',
  '/analytics',
  '/settings',
  '/subscription',
  '/payment',
]

// Routes that logged-in users should be bounced away from
const AUTH_ONLY_PATHS = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow auth callback through — never intercept OAuth redirects
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  // Allow the landing page through — it handles its own redirect
  if (pathname === '/') {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  const response = NextResponse.next({ request: { headers: request.headers } })

  // Determine which category this path falls into
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const isAuthOnly = AUTH_ONLY_PATHS.includes(pathname)

  // If the route doesn't need special handling, skip the Supabase call entirely
  if (!isProtected && !isAuthOnly) {
    return response
  }

  // Try to validate the session server-side. Wrap in try/catch so any
  // network error, misconfigured env var, or Supabase outage fails open
  // (passes the request through) rather than locking all users out.
  let user = null
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  } catch {
    // Supabase unreachable — fail open so the app stays accessible.
    // Each page's client-side guard will catch unauthenticated state.
    return response
  }

  // ── Protected route, no session → send to login ─────────────────────────
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Auth-only page, already logged in → send to dashboard ───────────────
  if (isAuthOnly && user) {
    const next = request.nextUrl.searchParams.get('next')
    const dest =
      next && next.startsWith('/') && !next.startsWith('//')
        ? next
        : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
}
