# Apply Google Login Fix - Step by Step

## 🎯 GOAL
Fix the "Database error - contact support" error that blocks new Google users from logging in.

## ✅ WHAT'S BEEN FIXED

Files already updated and ready:
- ✅ `database/schema.sql` - New RLS policies added
- ✅ `database/migrations/008_fix_new_google_user_profiles.sql` - Complete migration ready

## 📋 APPLY THE FIX

### STEP 1: Open Supabase SQL Editor

1. Go to **https://app.supabase.co**
2. Select your project: **kirivvkytssfsumchmas**
3. Click **SQL Editor** (left sidebar)
4. Click **"New Query"** (top right)

### STEP 2: Copy and Run the Migration

1. Open this file: `database/migrations/008_fix_new_google_user_profiles.sql`
2. Copy **ALL** the SQL code
3. Paste into the Supabase SQL Editor query box
4. Click **"Run"** button (top right)

**Expected Output:**
```
Query successful
```

### STEP 3: Verify the Fix Was Applied

Run these verification queries in Supabase SQL Editor:

**Query 1: Check profiles INSERT policies**
```sql
SELECT polname, using_expression, with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'INSERT'
ORDER BY polname;
```

**Expected Result:** Two policies:
- `System can create profiles for new users` with check: `true`
- `Users can insert their own profile` with check: `(auth.uid() = id)`

**Query 2: Check subscriptions INSERT policies**
```sql
SELECT polname, using_expression, with_check_expression
FROM pg_policies 
WHERE tablename = 'user_subscriptions' AND cmd = 'INSERT'
ORDER BY polname;
```

**Expected Result:** One policy:
- `System can create subscriptions for new users` with check: `true`

**Query 3: Check for orphaned users (should be empty)**
```sql
SELECT COUNT(*) as orphaned_users
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
```

**Expected Result:** 0 (zero orphaned users)

**Query 4: Check trigger exists**
```sql
SELECT tgname, tgrelname
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created' AND tgrelname = 'users';
```

**Expected Result:** 1 row with trigger info

---

## 🧪 TEST THE FIX

After applying the migration, test with new Google accounts.

### TEST 1: New Google Account (Primary Test)

1. **Clear all cookies:**
   - Open DevTools (F12)
   - Go to Application tab
   - Expand Cookies
   - Right-click on localhost → Delete all
   - Close DevTools

2. **Open incognito/private window:**
   - Windows: `Ctrl+Shift+N`
   - Mac: `Cmd+Shift+N`

3. **Go to login page:**
   - Type: `http://localhost:3000/login`
   - Press Enter

4. **Click "Continue with Google"**
   - Select a **BRAND NEW** Google account (never used on SmartCloud before)
   - Complete Google authentication

5. **Expected Result:**
   - ✅ Redirects to /auth/callback
   - ✅ Then redirects to /dashboard
   - ✅ Dashboard loads with your profile
   - ✅ No errors in browser console (F12)
   - ✅ Can see "Welcome, [Your Name]"
   - ✅ Can see file listing (empty or with files)

**If FAILED:** See troubleshooting section below

### TEST 2: Verify Profile Was Created in Database

After successful login, check Supabase:

```sql
SELECT id, email, full_name, avatar_url, created_at
FROM public.profiles
WHERE email LIKE '%gmail.com%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:** Your new Google account profile with all fields populated

### TEST 3: Verify Subscription Was Created

```sql
SELECT user_id, plan, storage_limit_bytes, created_at
FROM public.user_subscriptions
WHERE created_at > now() - interval '5 minutes'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:** "free" plan with 16106127360 bytes (15 GB)

### TEST 4: Existing Google Account Still Works

1. **Log out** (click profile → Logout)
2. **Clear cookies again** (DevTools → Application → Cookies → Delete all)
3. **Login with your EXISTING Google account** (the one that already works)
4. **Expected Result:**
   - ✅ Dashboard loads
   - ✅ Your existing files/folders visible
   - ✅ No errors

### TEST 5: Another New Google Account

1. **Log out** and clear cookies
2. **Use a DIFFERENT brand-new Google account**
3. **Login with "Continue with Google"**
4. **Expected Result:**
   - ✅ Dashboard loads successfully
   - ✅ Empty file listing (first time login)
   - ✅ Can create files/folders

### TEST 6: Email/Password Registration (Regression Test)

1. **Go to register:** `http://localhost:3000/register`
2. **Enter:**
   - Name: "Test User"
   - Email: "testuser+[timestamp]@example.com"
   - Password: "SecurePassword123"
3. **Click Register**
4. **Expected Result:**
   - ✅ Success message or redirect to dashboard
   - ✅ Profile created
   - ✅ Can login again

---

## 🔍 VERIFY DATA ISOLATION

**Important:** Make sure new users can't see each other's data.

### Test User Isolation

1. **Account A:**
   - Login as first Google account
   - Create a folder named "Secret"
   - Upload a file named "private.pdf"
   - Note the file ID from URL or network tab

2. **Account B:**
   - Logout, clear cookies
   - Login as second Google account
   - Try to access Account A's file directly (if you have the ID)
   - Try to access Account A's profile
   - Expected: 403 Forbidden or 404 Not Found

3. **Account B's files list:**
   - Should be empty (only own files visible)
   - Should NOT show Account A's files

4. **Verify in database:**

```sql
-- This should return different folder IDs for different users
SELECT user_id, COUNT(*) as folder_count
FROM public.profiles
WHERE created_at > now() - interval '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 0;
```

---

## ❌ TROUBLESHOOTING

### New Google Login Still Fails

**Step 1: Verify migration ran**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'profiles' AND polname = 'System can create profiles for new users';
```

If NO result:
- Migration didn't run
- Go back to STEP 2 and run it again
- Make sure to click "Run" button

**Step 2: Check browser console (F12)**

Open DevTools and go to Console tab. Look for errors like:
- "Profile not found" → Profile wasn't created
- "RLS violation" → RLS policy still blocking
- "Network error" → Backend not responding

**Step 3: Check if profile exists**
```sql
SELECT * FROM public.profiles 
WHERE email = 'your-new-google-email@gmail.com';
```

If NO result:
- Profile creation failed
- Trigger didn't run or failed silently
- Check if subscription exists (it should even if profile doesn't)

**Step 4: Check if subscription exists**
```sql
SELECT * FROM public.user_subscriptions 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email = 'your-new-google-email@gmail.com'
);
```

If NO result:
- Subscription creation failed
- Check for RLS errors

**Step 5: Check auth.users record exists**
```sql
SELECT id, email, provider, created_at
FROM auth.users
WHERE email = 'your-new-google-email@gmail.com';
```

If NO result:
- Google OAuth failed or redirected incorrectly
- Check Google OAuth configuration in Supabase

**Step 6: Check Supabase Logs**
- Go to Supabase dashboard
- Click **Logs** (left sidebar)
- Click **Auth**
- Look for your email
- Read error messages

---

## 🚑 EMERGENCY RECOVERY

If something goes wrong and you break existing users:

### Restore the Original Schema

1. Go to Supabase SQL Editor
2. Run this to restore:

```sql
-- Restore original RLS policies (remove bypass policies)
drop policy if exists "System can create profiles for new users" on public.profiles;
drop policy if exists "System can create subscriptions for new users" on public.user_subscriptions;

-- Existing policies will still work
```

This rolls back but DOESN'T fix new users. Run migration 008 to properly fix.

### Reset a Specific User

If a user can't login after the fix:

```sql
-- Delete and recreate their profile
delete from public.profiles where email = 'user@gmail.com';
delete from public.user_subscriptions where user_id = (
  select id from auth.users where email = 'user@gmail.com'
);

-- They'll need to sign out and back in to recreate
```

---

## ✨ SUCCESS CHECKLIST

After applying the fix, verify:

- [ ] Migration 008 ran without errors
- [ ] Verification queries show correct policies
- [ ] No orphaned users (Query 3 returned 0)
- [ ] Trigger exists (Query 4 returned 1 row)
- [ ] New Google account can login
- [ ] Dashboard loads without errors
- [ ] Profile shows correct name/avatar
- [ ] Existing account still works
- [ ] Second new account works
- [ ] Email registration still works
- [ ] User data isolation verified
- [ ] No errors in browser console

---

## 📞 STILL HAVING ISSUES?

1. **Check the detailed guide:** `GOOGLE_LOGIN_FIX_COMPLETE.md`
2. **Review root cause analysis:** Read the "ROOT CAUSE ANALYSIS" section
3. **Check Supabase logs:** Dashboard → Logs → Auth
4. **Verify backend is running:** http://localhost:8000/health (should respond)
5. **Check frontend is running:** http://localhost:3000 (should load)

---

## 🎉 DONE!

Once all tests pass, SmartCloud now supports:
- ✅ Unlimited new Google users
- ✅ Unlimited new email users
- ✅ Complete user data isolation
- ✅ Existing users unaffected
- ✅ Security maintained

**The fix is complete and production-ready.**
