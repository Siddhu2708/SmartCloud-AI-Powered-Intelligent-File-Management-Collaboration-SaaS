import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

/**
 * OAuth Callback Route Handler
 * 
 * This route handles the OAuth callback from Supabase after user authentication.
 * Common errors and solutions are documented below.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next')
  
  // Validate redirect path
  const redirectPath = next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/dashboard'

  // Handle OAuth provider errors
  if (oauthError) {
    console.error('[Auth Callback] OAuth error:', {
      error: oauthError,
      code: errorCode,
      description: errorDescription,
    })
    
    let userMessage = 'OAuth authentication failed'
    
    if (oauthError === 'server_error') {
      if (errorDescription?.includes('Database')) {
        userMessage = 'Database error - contact support'
      } else if (errorDescription?.includes('unexpected_failure')) {
        userMessage = 'Google OAuth not configured - add credentials to Supabase'
      } else {
        userMessage = `Server error: ${errorDescription}`
      }
    } else if (oauthError === 'invalid_request') {
      userMessage = 'Invalid OAuth request - refresh and try again'
    } else if (oauthError === 'access_denied') {
      userMessage = 'Google login was cancelled'
    } else {
      userMessage = errorDescription || oauthError
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed&reason=${encodeURIComponent(userMessage)}`, origin)
    )
  }

  // No code means OAuth not configured
  if (!code) {
    console.error('[Auth Callback] Missing OAuth code - Google OAuth likely not configured')
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed&reason=OAuth+not+configured+-+add+Google+credentials+to+Supabase`, origin)
    )
  }

  const response = NextResponse.redirect(new URL(redirectPath, origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieList = request.headers
            .get('cookie')
            ?.split('; ')
            .map((cookie) => {
              const [name, ...rest] = cookie.split('=')
              return { name, value: rest.join('=') }
            }) ?? []
          return cookieList
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as CookieOptions)
          })
        },
      },
    }
  )

  const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[Auth Callback] Code exchange failed:', {
      message: exchangeError.message,
      status: exchangeError.status,
    })
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed&reason=${encodeURIComponent(exchangeError.message)}`, origin)
    )
  }

  if (!data.session) {
    console.error('[Auth Callback] No session from code exchange')
    return NextResponse.redirect(
      new URL('/login?error=auth_failed&reason=Session+creation+failed', origin)
    )
  }

  console.log('[Auth Callback] Success', {
    userId: data.session.user.id,
    provider: data.session.user.app_metadata?.provider,
  })

  return response
}
