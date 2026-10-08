-- ============================================================
-- DATABASE VERIFICATION QUERIES
-- Run these in Supabase SQL Editor to verify database state
-- ============================================================

-- ============================================================
-- 1. VERIFY TABLES EXIST
-- ============================================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'user_subscriptions', 'folders', 'files', 'shares', 'audit_logs', 'document_chunks')
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 2. VERIFY PRIMARY KEYS
-- ============================================================
SELECT
  t.tablename,
  a.attname as pk_column,
  format_type(a.atttypid, a.atttypmod) as type
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
AND ix.indisprimary
AND t.relnamespace = 'public'::regnamespace
AND t.relname IN ('profiles', 'user_subscriptions', 'folders', 'files', 'shares', 'audit_logs', 'document_chunks')
ORDER BY t.tablename, a.attnum;

-- ============================================================
-- 3. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================
SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.referential_constraints
JOIN information_schema.key_column_usage ON referential_constraints.constraint_name = key_column_usage.constraint_name
WHERE constraint_schema = 'public'
ORDER BY table_name;

-- ============================================================
-- 4. VERIFY UNIQUE CONSTRAINTS
-- ============================================================
SELECT
  constraint_name,
  table_name,
  column_name
FROM information_schema.constraint_column_usage
WHERE table_schema = 'public'
AND constraint_type = 'UNIQUE'
ORDER BY table_name;

-- ============================================================
-- 5. VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================================
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'user_subscriptions', 'folders', 'files', 'shares', 'audit_logs', 'document_chunks')
ORDER BY tablename;

-- ============================================================
-- 6. VERIFY ALL RLS POLICIES FOR PROFILES TABLE
-- ============================================================
SELECT
  polname,
  cmd,
  using_expression,
  with_check_expression,
  permissive
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY polname;

-- ============================================================
-- 7. VERIFY ALL RLS POLICIES FOR USER_SUBSCRIPTIONS TABLE
-- ============================================================
SELECT
  polname,
  cmd,
  using_expression,
  with_check_expression,
  permissive
FROM pg_policies
WHERE tablename = 'user_subscriptions'
ORDER BY polname;

-- ============================================================
-- 8. VERIFY ALL RLS POLICIES FOR OTHER TABLES
-- ============================================================
SELECT
  tablename,
  polname,
  cmd,
  using_expression,
  with_check_expression
FROM pg_policies
WHERE tablename IN ('folders', 'files', 'shares', 'audit_logs', 'document_chunks')
ORDER BY tablename, polname;

-- ============================================================
-- 9. VERIFY TRIGGER EXISTS
-- ============================================================
SELECT
  tgname,
  tgrelname,
  tgtype,
  tgfoid::regprocedure as function_name
FROM pg_trigger
WHERE tgrelname = 'users'
AND tgname = 'on_auth_user_created';

-- ============================================================
-- 10. VERIFY TRIGGER FUNCTION
-- ============================================================
SELECT
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'handle_new_user';

-- ============================================================
-- 11. CHECK FOR ORPHANED USERS (no profile)
-- ============================================================
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN p.id IS NULL THEN 'MISSING PROFILE' ELSE 'OK' END as profile_status,
  CASE WHEN s.user_id IS NULL THEN 'MISSING SUBSCRIPTION' ELSE 'OK' END as subscription_status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_subscriptions s ON au.id = s.user_id
WHERE p.id IS NULL OR s.user_id IS NULL
ORDER BY au.created_at DESC;

-- ============================================================
-- 12. CHECK ALL USERS AND THEIR PROFILES/SUBSCRIPTIONS
-- ============================================================
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN p.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as profile,
  CASE WHEN s.user_id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as subscription,
  COALESCE(s.plan, 'N/A') as plan
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_subscriptions s ON au.id = s.user_id
ORDER BY au.created_at DESC
LIMIT 20;

-- ============================================================
-- 13. VERIFY PROFILES TABLE STRUCTURE
-- ============================================================
\d+ public.profiles

-- ============================================================
-- 14. VERIFY USER_SUBSCRIPTIONS TABLE STRUCTURE
-- ============================================================
\d+ public.user_subscriptions

-- ============================================================
-- 15. CHECK DEFAULT VALUES
-- ============================================================
SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'user_subscriptions')
AND column_default IS NOT NULL
ORDER BY table_name, ordinal_position;
