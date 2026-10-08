# ✅ Verification & Testing Guide

## STEP 1: Verify Database Setup in Supabase

Run these queries one by one in Supabase SQL Editor to confirm everything was created:

### Query 1: Check All Tables
```sql
select tablename 
from pg_tables 
where schemaname = 'public' 
and tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')
order by tablename;
```
**Should show:** 8 tables ✅

### Query 2: Check RLS is Enabled
```sql
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public' 
and tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')
order by tablename;
```
**Should show:** 8 tables with rowsecurity = true ✅

### Query 3: Check Trigger Exists
```sql
select tgname, tgrelname 
from pg_trigger 
where tgname = 'on_auth_user_created';
```
**Should show:** 1 trigger ✅

### Query 4: Check Policies
```sql
select tablename, count(*) as policy_count
from pg_policies
where tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')
group by tablename
order by tablename;
```
**Should show:** Policies for each table ✅

---

## STEP 2: Test New Google Account Login

### Prerequisites
- [ ] Clear all cookies in your browser
- [ ] Have a **NEW** Google account ready (one that has NEVER logged into SmartCloud before)
- [ ] SmartCloud app is running

### Test Steps

1. **Open SmartCloud App**
   - [ ] Go to your app URL
   - [ ] Should see login page

2. **Click "Login with Google"**
   - [ ] You'll be redirected to Google login

3. **Use NEW Google Account**
   - [ ] Enter Google email (NEW account - never used before)
   - [ ] Enter password
   - [ ] Grant permissions if prompted

4. **Check Result**
   - [ ] Should redirect back to your app
   - [ ] Should see dashboard ✅
   - [ ] Should NOT see "Database error - contact support" ❌

### Verify Profile Was Created

After successful login, run this in Supabase SQL Editor:

```sql
select id, email, full_name, created_at 
from public.profiles 
order by created_at desc 
limit 1;
```

**Should show:** Your new user profile ✅

### Verify Subscription Was Created

```sql
select user_id, plan, created_at 
from public.user_subscriptions 
order by created_at desc 
limit 1;
```

**Should show:** free plan subscription for your new user ✅

---

## STEP 3: Test Existing Google Account

If you have an existing test account:

1. **Logout** from new account
2. **Login with existing Google account**
   - [ ] Should still work ✅
   - [ ] Should see your previous data

---

## STEP 4: Test Email Registration (if available)

If your app supports email signup:

1. **Register new email account**
   - [ ] Use new email (never registered before)
   - [ ] Set password

2. **Check result**
   - [ ] Should create account ✅
   - [ ] Should see dashboard
   - [ ] Run profile check query above

---

## SUCCESS CRITERIA

| Test | Status | Notes |
|------|--------|-------|
| Database tables created | ✅ | 8 tables exist |
| RLS enabled | ✅ | All tables have RLS |
| Trigger created | ✅ | on_auth_user_created exists |
| Policies created | ✅ | Each table has policies |
| New Google user login | ? | Should work now |
| Profile auto-created | ? | Should exist in profiles table |
| Subscription auto-created | ? | Should exist in user_subscriptions |
| Existing user still works | ? | Previous data intact |
| No "Database error" message | ? | Login successful |

---

## TROUBLESHOOTING

### Issue: Still getting "Database error - contact support"

**Check 1:** Verify trigger was created
```sql
select * from pg_trigger where tgname = 'on_auth_user_created';
```

**Check 2:** Verify policies exist
```sql
select * from pg_policies where tablename = 'profiles';
```

**Check 3:** Check browser console for errors
- Open: Browser DevTools (F12)
- Check: Console tab for JavaScript errors
- Check: Network tab for failed API calls

**Check 4:** Verify RLS bypass policies
```sql
select policyname, policycmd, qual 
from pg_policies 
where tablename = 'profiles' 
and policyname like '%System%';
```

### Issue: Profile not created after login

**Possible causes:**
1. Trigger didn't fire → Check trigger exists (Query above)
2. RLS policy blocked INSERT → Check policies have bypass
3. Auth user not created → Check auth.users table in Supabase

**Solution:**
Manually insert profile (replace with your user_id):
```sql
insert into public.profiles (id, email, full_name)
values ('YOUR_USER_ID_HERE', 'test@example.com', 'Test User');
```

### Issue: Subscription not created

Same as profile - check trigger and policies.

Manual insert:
```sql
insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
values ('YOUR_USER_ID_HERE', 'free', 16106127360, 0);
```

---

## NEXT STEPS

Once all tests pass:

1. ✅ Database setup complete
2. ✅ New user login works
3. ✅ Profiles auto-created
4. Ready for production deployment

---

## BACKEND VERIFICATION

Check backend logs for any errors:

```bash
# If using Docker
docker logs smartcloud-backend

# Or check your error tracking service (Sentry, etc.)
```

Look for errors like:
- Auth errors
- Database connection errors
- Trigger execution errors

---

## NOTES

- The trigger runs automatically when a new user is created in auth.users
- Profile and subscription should be created within seconds
- If they're not created, check browser console for errors
- The RLS bypass policy allows the trigger to insert even when auth.uid() is NULL

