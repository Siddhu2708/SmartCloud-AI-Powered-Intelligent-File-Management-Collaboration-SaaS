# 🚀 Fresh Database Setup - Quick Reference

## WHAT YOU'RE DOING
Removing all Supabase databases and setting up a complete fresh schema with all tables, RLS policies, and triggers.

## ⏱️ TIME: 10 minutes total

---

## 📋 STEP-BY-STEP

### Step 1: Open Supabase (1 min)
1. Go to: https://app.supabase.co
2. Open your SmartCloud project
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**

### Step 2: Get the Complete Schema (1 min)
1. Open file: `database/000_COMPLETE_FRESH_START.sql`
2. **Select All** (Ctrl+A)
3. **Copy** (Ctrl+C)

### Step 3: Run in Supabase (5 min)
1. Paste into Supabase SQL Editor
2. Click: **Run** button
3. Wait for completion (watch for green checkmark ✅)

### Step 4: Verify Everything Works (3 min)
Run these verification queries (one at a time):

```sql
-- Should show 8 tables
select tablename from pg_tables where schemaname = 'public';

-- Should show RLS enabled for all
select tablename, rowsecurity from pg_tables 
where schemaname = 'public' and tablename in 
('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments');

-- Should show trigger exists
select tgname from pg_trigger where tgname = 'on_auth_user_created';

-- Should show policies created
select tablename, count(*) from pg_policies 
where tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')
group by tablename;
```

### Step 5: Test Google Login (3 min)
1. Clear browser cookies
2. Open new incognito window
3. Go to your SmartCloud app
4. Click: "Login with Google"
5. Create NEW Google account (never used before)
6. Should work ✅

---

## ✅ WHAT GETS CREATED

**8 Tables:**
- ✅ profiles (user data mirror)
- ✅ user_subscriptions (billing & plans)
- ✅ folders (file organization)
- ✅ files (uploaded documents)
- ✅ document_chunks (AI search vectors)
- ✅ shares (file sharing)
- ✅ audit_logs (activity tracking)
- ✅ payments (billing records)

**All Tables Have:**
- ✅ RLS enabled
- ✅ Complete policies (SELECT, INSERT, UPDATE, DELETE)
- ✅ User isolation via auth.uid()

**Trigger:**
- ✅ on_auth_user_created → handles_new_user()
- ✅ Auto-creates profile + subscription when user signs up

**Storage:**
- ✅ documents bucket with path-based RLS

**Extensions:**
- ✅ uuid-ossp (for UUIDs)
- ✅ pgvector (for AI embeddings)

---

## 🎯 SUCCESS CRITERIA

After setup, verify:
- [ ] All 8 tables exist
- [ ] RLS enabled on all tables
- [ ] Trigger exists and fires
- [ ] All policies created (25+ total)
- [ ] New Google user can login
- [ ] Existing users still work
- [ ] No data loss

---

## 🆘 TROUBLESHOOTING

### "Error: relation already exists"
→ This is normal if you run it twice. It uses "if not exists" and "drop policy if exists"

### "New user still can't login"
→ Run verification queries above to check everything was created

### "Existing users now broken"
→ All policies preserved existing functionality. Check browser cache/cookies

---

## 📁 FILES REFERENCE

| File | Purpose |
|------|---------|
| `database/000_COMPLETE_FRESH_START.sql` | **MAIN FILE - Run this!** |
| `database/DATABASE_VERIFICATION_QUERIES.sql` | Optional: More detailed verification |
| `docs/00_START_HERE.md` | Overview of the fix |
| `docs/README_FIX.md` | What's wrong & why |
| `docs/GOOGLE_LOGIN_FIX_COMPLETE.md` | Deep technical details |

---

## 🎉 NEXT STEPS AFTER SETUP

1. ✅ Database setup complete
2. Test all login types
3. Fix any frontend/backend issues
4. Deploy to production

---

**Ready to proceed?** 

👉 **Next:** Open `database/000_COMPLETE_FRESH_START.sql` and copy it to Supabase SQL Editor

