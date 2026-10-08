# ✅ Database Setup Checklist

## PRE-SETUP

- [ ] Backup any important data from Supabase (if needed)
- [ ] Have access to Supabase project admin panel
- [ ] File ready: `database/000_COMPLETE_FRESH_START.sql`

---

## SETUP PROCESS

### 1. Remove Old Databases ⚠️
- [ ] Go to Supabase Project Settings → Databases
- [ ] Delete ALL databases
- [ ] Wait for deletion to complete

### 2. Prepare Fresh Start SQL
- [ ] Open: `database/000_COMPLETE_FRESH_START.sql`
- [ ] **Select All** (Ctrl+A)
- [ ] **Copy** (Ctrl+C)

### 3. Run in Supabase
- [ ] Go to: https://app.supabase.co
- [ ] Open: Your SmartCloud project
- [ ] Click: SQL Editor
- [ ] Click: New Query
- [ ] **Paste** the SQL (Ctrl+V)
- [ ] Click: **Run** button
- [ ] Wait for completion (green checkmark ✅)

### 4. Verify Execution
- [ ] No errors shown in SQL Editor
- [ ] Check execution time (should be < 30 seconds)
- [ ] Scroll to see verification query results

---

## POST-SETUP VERIFICATION

Run these queries to verify (copy from `database/DATABASE_VERIFICATION_QUERIES.sql`):

### Verification 1: All Tables Exist
```sql
select count(*) as table_count from information_schema.tables 
where table_schema = 'public' 
and table_name in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments');
```
- [ ] Should show: 8

### Verification 2: RLS Enabled
```sql
select count(*) as rls_enabled from pg_tables 
where schemaname = 'public' 
and rowsecurity = true 
and tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments');
```
- [ ] Should show: 8

### Verification 3: Trigger Exists
```sql
select count(*) as trigger_count from pg_trigger 
where tgname = 'on_auth_user_created';
```
- [ ] Should show: 1

### Verification 4: Policies Created
```sql
select count(*) as policy_count from pg_policies 
where tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments');
```
- [ ] Should show: 25+

---

## TESTING

### Test 1: New Google User
- [ ] Clear all browser cookies
- [ ] Open incognito window
- [ ] Go to SmartCloud app
- [ ] Click "Login with Google"
- [ ] Use brand new Google account (never used before)
- [ ] Should see dashboard ✅
- [ ] Check profile created in database:
  ```sql
  select * from public.profiles order by created_at desc limit 1;
  ```

### Test 2: Existing User
- [ ] If you have existing test account, login with it
- [ ] Should still work ✅
- [ ] Should see same data as before

### Test 3: Email Registration
- [ ] Test email signup (if available)
- [ ] New account should create profile + subscription
- [ ] Should be able to login ✅

---

## TROUBLESHOOTING

### Issue: "Error: table already exists"
**Solution:** This is OK! The SQL uses "if not exists" and handles conflicts automatically.

### Issue: "Error: policy already exists"  
**Solution:** Script drops old policies first with "drop policy if exists". This is expected cleanup.

### Issue: Execution fails partway through
**Solution:** 
1. Scroll through output to find the error
2. Note which step failed
3. Check `database/000_COMPLETE_FRESH_START.sql` around that line
4. Can run again - it's idempotent

### Issue: Trigger not working (new users have no profile)
**Solution:**
1. Verify trigger exists:
   ```sql
   select * from pg_proc where proname = 'handle_new_user';
   ```
2. Check RLS bypass policies exist:
   ```sql
   select * from pg_policies 
   where schemaname = 'public' 
   and policyname ilike '%system%';
   ```

### Issue: Can't see new user profile
**Solutions:**
1. Check if profile was created:
   ```sql
   select * from public.profiles where email = 'test@example.com';
   ```
2. Check if subscription was created:
   ```sql
   select * from public.user_subscriptions where user_id = '<user_uuid>';
   ```
3. Check trigger execution logs (if available)
4. Manually create profile:
   ```sql
   insert into public.profiles (id, email) 
   values ('<user_uuid>', 'test@example.com');
   ```

---

## SUCCESS = ✅

When you see this:
- [x] All 8 tables exist
- [x] RLS enabled on all tables
- [x] 1 trigger exists
- [x] 25+ policies created
- [x] New Google user can login
- [x] Dashboard loads (no "Database error" message)
- [x] Profile visible in database

---

## NEXT STEPS

1. ✅ **Database ready**
2. Test all features (AI search, file upload, etc.)
3. Monitor error logs
4. Deploy to production when confident

---

## FILES USED

| File | Status |
|------|--------|
| `database/000_COMPLETE_FRESH_START.sql` | ← **Run this** |
| `database/DATABASE_VERIFICATION_QUERIES.sql` | Reference queries |
| `docs/QUICK_SETUP.md` | Quick reference |
| `docs/00_START_HERE.md` | Overview |
| `docs/README_FIX.md` | Problem explanation |

---

## QUESTIONS?

See:
- `docs/GOOGLE_LOGIN_FIX_COMPLETE.md` - Complete technical details
- `docs/APPLY_GOOGLE_LOGIN_FIX.md` - Troubleshooting guide
- `docs/00_START_HERE.md` - General overview

---

**Status:** Ready for setup ✅

**Next:** Run `database/000_COMPLETE_FRESH_START.sql` in Supabase SQL Editor

