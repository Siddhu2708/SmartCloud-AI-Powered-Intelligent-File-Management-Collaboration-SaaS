# ✅ AFTER DATABASE SETUP - What to Do Next

## YOU ARE HERE: Database is set up ✅

The complete fresh database has been created in Supabase with:
- ✅ 8 tables (profiles, subscriptions, files, folders, etc.)
- ✅ RLS enabled on all tables
- ✅ Auto-trigger for new user profile creation
- ✅ All policies in place

---

## NOW TEST: New User Google Login

**The main test:** Can a brand NEW Google account login?

### Quick Test (5 minutes)

1. **Clear cookies**
   - Open browser settings
   - Find SmartCloud in cookies
   - Delete all SmartCloud cookies

2. **Open incognito window**
   - Press: Ctrl+Shift+N (Windows)
   - Go to: Your SmartCloud app URL

3. **Click "Login with Google"**

4. **Use NEW Google account**
   - Email: A brand new Google account (never used before)
   - Password: Google password

5. **Check result**
   ```
   ✅ SUCCESS: Dashboard loads, no error message
   ❌ FAILURE: See "Database error - contact support"
   ```

---

## IF TEST PASSES ✅

Congrats! The Google login bug is fixed!

**Next:**
1. Test existing user (should still work)
2. Test other features (file upload, AI search, etc.)
3. Monitor error logs
4. Deploy to production

---

## IF TEST FAILS ❌

Still seeing "Database error - contact support"?

### Debug Steps

#### Step 1: Check database setup
Run in Supabase SQL Editor:
```sql
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public' 
and tablename = 'profiles';
```
Should show: `profiles | true`

#### Step 2: Check trigger exists
```sql
select tgname from pg_trigger 
where tgname = 'on_auth_user_created';
```
Should show: `on_auth_user_created`

#### Step 3: Check policies
```sql
select policyname from pg_policies 
where tablename = 'profiles';
```
Should show at least 4 policies including "System can create profiles for new users"

#### Step 4: Check browser console
1. Open browser (F12)
2. Go to Console tab
3. Try login again
4. Look for JavaScript errors
5. Check Network tab for failed API requests

#### Step 5: Check backend logs
If using Docker:
```bash
docker logs smartcloud-backend
```

Look for errors like:
- Database connection issues
- Auth errors
- Trigger execution errors

#### Step 6: Manual profile creation
After login (even if it fails), check if user was created:

In Supabase SQL Editor:
```sql
select * from auth.users 
order by created_at desc 
limit 1;
```

Get the user ID, then:
```sql
select * from public.profiles 
where id = 'PASTE_USER_ID_HERE';
```

If no profile exists:
1. Trigger didn't fire
2. RLS blocked the INSERT
3. Check the trigger function:
   ```sql
   select prosrc from pg_proc 
   where proname = 'handle_new_user';
   ```

---

## COMMON ISSUES & SOLUTIONS

### "Database error" still appears

**Most likely cause:** Frontend backend connection issue

**Check:**
1. Backend is running (`npm run dev` or Docker)
2. Backend can connect to database
3. CORS settings allow frontend to call backend
4. Environment variables are correct

**Backend check:**
```bash
# Test if backend is running
curl http://localhost:8000/health

# Should show: {"status": "ok"}
```

### Profile/subscription not auto-created

**Cause:** Trigger not executing

**Solution:**
```sql
-- Manually create profile
insert into public.profiles (id, email, full_name, avatar_url)
values ('USER_ID_HERE', 'user@example.com', 'User Name', null);

-- Manually create subscription
insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
values ('USER_ID_HERE', 'free', 16106127360, 0);
```

### RLS permission denied error

**Cause:** RLS policies blocking INSERT

**Check:**
```sql
select policyname, policycmd, qual 
from pg_policies 
where tablename = 'profiles' 
and policyname like '%System%';
```

Should show: `"System can create profiles for new users"` with `with check (true)`

---

## QUICK REFERENCE

| What | Where | Status |
|------|-------|--------|
| Database | Supabase | ✅ Created |
| Tables | 8 tables | ✅ Created |
| Trigger | on_auth_user_created | ✅ Created |
| Policies | RLS on all tables | ✅ Created |
| Test | New Google login | ? PENDING |

---

## NEXT STEPS

### If Everything Works ✅
1. Test existing user login
2. Test email registration
3. Test file upload
4. Test AI search
5. Deploy to production

### If Something Fails ❌
1. Check database setup (verification queries above)
2. Check backend logs
3. Check browser console
4. Read troubleshooting section above
5. Manually create profile/subscription if needed

---

## IMPORTANT FILES

| File | Purpose |
|------|---------|
| `database/000_COMPLETE_FRESH_START.sql` | Complete schema (already run) |
| `docs/VERIFICATION_AND_TESTING.md` | Detailed verification guide |
| `docs/GOOGLE_LOGIN_FIX_COMPLETE.md` | Technical deep dive |
| `docs/00_START_HERE.md` | Overview |

---

## SUPPORT

**Still stuck?**

Check these in order:
1. `docs/VERIFICATION_AND_TESTING.md` - Troubleshooting section
2. `docs/GOOGLE_LOGIN_FIX_COMPLETE.md` - Technical details
3. Backend logs - Error messages
4. Browser console - JavaScript errors

---

## YOU'RE ALMOST THERE! 🚀

The hard part (database fix) is done.

Now just test it and make sure new Google users can login.

Good luck! 💪

