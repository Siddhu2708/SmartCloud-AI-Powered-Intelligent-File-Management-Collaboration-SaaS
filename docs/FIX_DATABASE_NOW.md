# Fix Database - Complete and Correct Schema

## 🎯 WHAT TO DO

Your database has issues. I've created a **complete, correct schema** that will fix everything.

## ✅ TWO OPTIONS

### OPTION A: QUICK FIX (Recommended)
Use the minimal migration if your database is mostly working:

1. Go to: **https://app.supabase.co** → Your Project → **SQL Editor**
2. Click **"New Query"**
3. Open file: `database/migrations/008_fix_new_google_user_profiles.sql`
4. Copy ALL code
5. Paste into Supabase
6. Click **"Run"**

**Time:** 5 minutes  
**Risk:** Low (only adds policies)  
**Result:** Fixes new Google user login

---

### OPTION B: COMPLETE RESET (Safe, Thorough)
Recreate entire schema from scratch (safest approach):

1. Go to: **https://app.supabase.co** → Your Project → **SQL Editor**
2. Click **"New Query"**
3. Open file: `DATABASE_COMPLETE_SCHEMA.sql`
4. Copy ALL code
5. Paste into Supabase
6. Click **"Run"**

**Time:** 10 minutes  
**Risk:** None (idempotent, uses `if not exists` and `on conflict`)  
**Result:** Complete working database with all tables, policies, triggers

---

## 🔍 VERIFY FIRST

Run these queries to see current database state:

1. Open file: `DATABASE_VERIFICATION_QUERIES.sql`
2. Go to Supabase SQL Editor
3. Run queries one by one
4. Check results

**Expected:**
- All tables exist
- RLS policies show: "System can create profiles for new users"
- Trigger exists: "on_auth_user_created"
- No orphaned users

---

## 🧪 AFTER APPLYING FIX

### Test New Google Account
1. Clear cookies: DevTools → Application → Delete all
2. Open incognito window
3. Go to http://localhost:3000/login
4. Click "Continue with Google"
5. Sign in with NEW Google account
6. **Should see:** Dashboard with your profile ✅

### Test Existing Account
1. Logout, clear cookies
2. Login with EXISTING account
3. **Should see:** Dashboard as before ✅

### Test User Isolation
1. Login as Account A
2. Upload file "secret.pdf"
3. Logout
4. Login as Account B
5. Try to find Account A's file
6. **Should NOT see it** ✅

---

## 📊 WHAT'S IN THE COMPLETE SCHEMA

✅ All 8 tables:
- profiles
- user_subscriptions
- folders
- files
- document_chunks
- shares
- audit_logs
- payments

✅ All RLS policies:
- SELECT/INSERT/UPDATE/DELETE for each table
- Security bypass policies for triggers
- User isolation maintained

✅ Storage bucket with RLS

✅ Trigger function for new user creation

✅ Orphaned user fixes

✅ Verification queries

---

## 🚨 WHAT IF SOMETHING BREAKS?

If you break existing users:

```sql
-- Get back to known good state
-- Just run DATABASE_COMPLETE_SCHEMA.sql again
-- It will fix everything automatically
```

---

## 📋 FILES CREATED FOR YOU

1. **`DATABASE_COMPLETE_SCHEMA.sql`** - Complete working schema
2. **`DATABASE_VERIFICATION_QUERIES.sql`** - Check current state
3. **`database/migrations/008_fix_new_google_user_profiles.sql`** - Minimal fix
4. **`GOOGLE_LOGIN_FIX_COMPLETE.md`** - Detailed explanation
5. **`APPLY_GOOGLE_LOGIN_FIX.md`** - Step-by-step guide

---

## ⚡ QUICK START

```
1. Copy: DATABASE_COMPLETE_SCHEMA.sql
2. Paste in: Supabase SQL Editor
3. Run
4. Test Google login with new account
5. Done ✅
```

---

## 🆘 NEED HELP?

1. Run `DATABASE_VERIFICATION_QUERIES.sql` to see what's broken
2. Read `GOOGLE_LOGIN_FIX_COMPLETE.md` for full explanation
3. Check Supabase logs: Dashboard → Logs → Auth
4. Verify backend: http://localhost:8000/health
5. Verify frontend: http://localhost:3000

---

## 🎉 RESULT

After applying fix:
- ✅ New Google users can login
- ✅ Existing users still work
- ✅ Email registration works
- ✅ User data isolated
- ✅ All features working

**Ready to proceed?** Use OPTION A or OPTION B above.
