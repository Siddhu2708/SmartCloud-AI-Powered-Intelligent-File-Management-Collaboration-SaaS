# Google OAuth Configuration for SmartCloud

## Overview

This document explains how Google OAuth works in SmartCloud and how to configure it correctly.

## Current Implementation

### Frontend Flow

1. User clicks "Continue with Google" button on `/login`
2. `handleGoogleLogin()` calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Supabase redirects to Google login page
4. User authenticates with Google account
5. Google redirects back to Supabase with authorization code
6. Supabase redirects to `/auth/callback?code=...`
7. Our callback route exchanges code for session
8. Session cookies set, user redirected to `/dashboard`

### Key Files

- `frontend/src/app/login/page.tsx` - Initiates OAuth
- `frontend/src/app/auth/callback/route.ts` - Handles OAuth callback
- `frontend/.env.local` - Contains Supabase public keys (safe)

## Configuration Requirements

### 1. Google Cloud Console Setup

**Location:** https://console.cloud.google.com

**Steps:**
1. Create/select project
2. Enable Google+ API
3. Create OAuth 2.0 Client ID (type: Web Application)
4. Add Authorized JavaScript Origins:
   - `http://localhost:3000` (development)
   - `http://localhost` (development)
   - `https://yourdomain.com` (production)

5. Add Authorized Redirect URIs:
   - `https://kirivvkytssfsumchmas.supabase.co/auth/v1/callback?provider=google`
   - `http://localhost:3000/auth/callback` (for local testing via Supabase redirect)

**Get:**
- Client ID (looks like: `xxx.apps.googleusercontent.com`)
- Client Secret (looks like: `xxx...`)

### 2. Supabase Configuration

**Location:** https://app.supabase.com → Authentication → Providers

**Steps:**
1. Select "Google" provider
2. Toggle "Enabled" to ON
3. Paste Client ID from Google Console
4. Paste Client Secret from Google Console
5. Click "Save"
6. Wait 1-2 minutes for changes to apply

### 3. Verify Configuration

**Check Supabase Setup:**
- Go to Authentication → Providers
- Google should show "Enabled"
- Should display: "Project key: [your-supabase-url]"

**Test Locally:**
1. Start frontend: `npm run dev`
2. Visit `http://localhost:3000/login`
3. Click "Continue with Google"
4. Should redirect to Google login (if configured)
5. After Google login, should redirect back to dashboard

## Common Errors

### "OAuth not configured"
- **Cause:** Google credentials not added to Supabase
- **Fix:** Add Client ID and Secret to Supabase dashboard

### "Redirect URI mismatch"
- **Cause:** Redirect URIs don't match in Google Console
- **Fix:** Verify exact URI in Google Console matches:
  - `https://kirivvkytssfsumchmas.supabase.co/auth/v1/callback?provider=google`
  - Include the `?provider=google` query parameter!

### "localhost not allowed"
- **Cause:** Local development URLs not in Google Console
- **Fix:** Add to Google Console Authorized Origins:
  - `http://localhost:3000`
  - `http://localhost`

### "Invalid OAuth request"
- **Cause:** Supabase project URL mismatch
- **Fix:** Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` matches Supabase dashboard

## Environment Variables

**Frontend (.env.local)** - Public keys only
```
NEXT_PUBLIC_SUPABASE_URL=https://kirivvkytssfsumchmas.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_anon_key_here
```

**Backend (.env)** - Never expose to frontend
```
SUPABASE_URL=https://kirivvkytssfsumchmas.supabase.co
SUPABASE_KEY=sb_service_role_key_here
```

## How It Works

### Flow Diagram

```
User clicks "Continue with Google"
    ↓
Frontend: supabase.auth.signInWithOAuth()
    ↓
Redirect to Google login
    ↓
User authenticates with Google
    ↓
Google redirects to Supabase callback
    ↓
Supabase redirects to frontend /auth/callback?code=...
    ↓
Frontend exchanges code for session
    ↓
Session cookies set
    ↓
Redirect to /dashboard
    ↓
User logged in ✓
```

### Session Creation

When OAuth succeeds:
1. `handle_new_user()` trigger creates profile row
2. `handle_new_user_subscription()` trigger creates free subscription
3. Session automatically created with JWT cookie
4. User data available via `supabase.auth.getUser()`

### User Isolation

- Profiles table has RLS: users can only read their own profile
- Each user can only access their own files/folders
- OAuth links to correct Supabase user ID automatically

## Testing

### Manual Test Checklist

- [ ] Frontend loads at http://localhost:3000
- [ ] Login page displays "Continue with Google" button
- [ ] Click button → redirects to Google login
- [ ] Google login → permission prompt appears
- [ ] Approve → redirects back to dashboard
- [ ] Dashboard shows correct user info
- [ ] Page refresh → user still logged in
- [ ] Logout → redirects to login page
- [ ] Try login again → works

### Troubleshooting

1. **Check browser console (F12)**
   - Look for `[Login] Google OAuth error` messages
   - Check Network tab for failed requests

2. **Check backend logs**
   - Look for CORS errors
   - Check if callback endpoint responding

3. **Verify configuration**
   - Go to Google Console and check URIs
   - Go to Supabase dashboard and check provider is enabled
   - Verify keys are correct (no typos, no extra spaces)

4. **Clear cache**
   - Browser cache: Ctrl+Shift+R
   - Browser cookies: DevTools → Application → Clear storage

## Production Deployment

### Before Going Live

1. **Update Google Console**
   - Add production domain to Authorized Origins
   - Add production callback URI to Redirect URIs
   - Example: `https://yourdomain.com/auth/callback`

2. **Update Supabase**
   - If using different Supabase project for production
   - Add Google credentials for production project
   - Verify redirect URLs match

3. **Update Environment**
   - `NEXT_PUBLIC_SUPABASE_URL` → production Supabase URL
   - `FRONTEND_URL` in backend → production domain
   - CORS allow_origins → production domain

4. **Test**
   - Test OAuth flow in production
   - Verify session persists
   - Check logs for errors

## Security Notes

- ✅ Client ID is public (safe in browser)
- ✅ Client Secret stays on Supabase servers (never exposed)
- ✅ JWT session tokens in HTTPOnly cookies (can't be accessed by JavaScript)
- ✅ RLS ensures users can't access other users' data
- ✅ CORS restricted to frontend domain

## Support

If OAuth isn't working:
1. Check this file for setup requirements
2. Verify Google Console configuration
3. Verify Supabase provider is enabled
4. Check browser console for specific error message
5. Wait 1-2 minutes if you just added credentials (Supabase propagation delay)
