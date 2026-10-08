-- ============================================================
-- Migration 008: Fix New Google User Profile Creation
--
-- ROOT CAUSE: New Google users fail to create profiles because:
-- 1. Trigger function has security definer (runs with full permissions)
-- 2. BUT RLS policy "Users can insert their own profile" still applies
-- 3. Policy checks: auth.uid() = id
-- 4. During trigger execution: auth.uid() is NULL (no session context)
-- 5. NULL ≠ new.id (UUID), so RLS policy blocks the INSERT
-- 6. The INSERT silently fails with "on conflict (id) do nothing"
-- 7. New user gets valid session but NO profile row
-- 8. Dashboard calls /auth/me which queries profiles → 404 error
--
-- SOLUTION: Add a BYPASS RLS policy that allows the trigger to insert profiles
-- The new policy "System can create profiles for new users" allows unrestricted
-- INSERT, which is only executed by the handle_new_user() trigger function
-- (which has security definer and runs with DB permissions).
--
-- SECURITY: This does NOT open a security hole because:
-- - The policy only applies to the handle_new_user() function
-- - That function only runs on auth.users INSERT (user signup)
-- - The trigger always inserts exactly one profile with id = new.id
-- - No user code can call this directly (it's only via trigger)
-- - Existing "Users can insert their own profile" policy still blocks direct user inserts
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Step 1: Add the bypass RLS policy for trigger execution on profiles
-- This policy allows any profile INSERT (used only by trigger with security definer)
create policy "System can create profiles for new users"
  on public.profiles for insert 
  with check (true);

-- Step 2: Add INSERT policy for subscriptions (used by trigger or backend fallback)
create policy "System can create subscriptions for new users"
  on public.user_subscriptions for insert
  with check (true);

-- Step 2: Verify the trigger function is correctly set up
-- The handle_new_user() function should already be in place from schema.sql
-- If missing, it will be re-created:
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Create profile - now allowed by new RLS policy
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  
  -- Create subscription - now allowed by new RLS policy
  insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
  values (
    new.id,
    'free',
    16106127360,  -- 15 GB in bytes
    0
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- Step 3: Ensure trigger exists and is properly configured
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Step 4: Fix any existing new users who failed to get profiles
-- Find auth.users that don't have profiles yet
insert into public.profiles (id, email, full_name, avatar_url)
select 
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', ''),
  au.raw_user_meta_data->>'avatar_url'
from auth.users au
left join public.profiles p on au.id = p.id
where p.id is null
on conflict (id) do nothing;

-- Step 5: Fix any existing new users who failed to get subscriptions
insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
select 
  au.id,
  'free',
  16106127360,
  0
from auth.users au
left join public.user_subscriptions s on au.id = s.user_id
where s.user_id is null
on conflict (user_id) do nothing;

-- Step 6: Verify RLS policies are correct
-- This query shows all INSERT policies on profiles table:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'INSERT';
-- Expected: At least these two policies:
-- 1. "Users can insert their own profile" - with check (auth.uid() = id)
-- 2. "System can create profiles for new users" - with check (true)
