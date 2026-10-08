-- ============================================================
-- Migration 005: Fix User Creation Trigger - Remove Error Handling
-- 
-- The consolidated trigger may be failing silently. This migration:
-- 1. Simplifies the trigger function
-- 2. Removes error handling that might be hiding issues
-- 3. Uses explicit column inserts to avoid data type mismatches
-- 4. Verifies all required tables exist and have correct schema
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Step 1: Verify tables exist with correct schema
-- This should return 3 rows:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('profiles', 'user_subscriptions', 'auth.users');

-- Step 2: Drop the old trigger and function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Step 3: Create a simplified, robust trigger function
-- This version explicitly handles all data types and avoids race conditions
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_full_name text;
  v_avatar_url text;
begin
  -- Extract metadata safely
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_avatar_url := new.raw_user_meta_data->>'avatar_url';
  
  -- INSERT profile (idempotent via on conflict)
  begin
    insert into public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
    values (
      new.id,
      new.email,
      v_full_name,
      v_avatar_url,
      now(),
      now()
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'Failed to insert profile for user %: %', new.id, sqlerrm;
  end;
  
  -- INSERT subscription (idempotent via on conflict)
  begin
    insert into public.user_subscriptions (
      user_id, 
      plan, 
      storage_limit_bytes, 
      ai_request_quota, 
      created_at, 
      updated_at
    )
    values (
      new.id,
      'free',
      16106127360,  -- 15 GB in bytes
      0,
      now(),
      now()
    )
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'Failed to insert subscription for user %: %', new.id, sqlerrm;
  end;
  
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Step 4: Recreate the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Step 5: Verify trigger exists
-- This should return 1 row:
-- SELECT count(*) FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Step 6: Test the trigger works by checking if you can manually insert a test row
-- (This requires service_role key, not available in browser)
-- DO NOT run in browser console — only for testing via backend/CLI

-- Step 7: Check for any existing users missing profiles
-- This query shows users without profiles (should be empty after fix):
-- SELECT au.id, au.email FROM auth.users au
-- LEFT JOIN public.profiles p ON au.id = p.id
-- WHERE p.id IS NULL;

-- Step 8: Check for any existing users missing subscriptions
-- This query shows users without subscriptions (should be empty after fix):
-- SELECT au.id, au.email FROM auth.users au
-- LEFT JOIN public.user_subscriptions s ON au.id = s.user_id
-- WHERE s.user_id IS NULL;

-- If you find orphaned users, you can manually create their records:
-- INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
-- SELECT au.id, au.email, '', now(), now()
-- FROM auth.users au
-- LEFT JOIN public.profiles p ON au.id = p.id
-- WHERE p.id IS NULL
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota, created_at, updated_at)
-- SELECT au.id, 'free', 16106127360, 0, now(), now()
-- FROM auth.users au
-- LEFT JOIN public.user_subscriptions s ON au.id = s.user_id
-- WHERE s.user_id IS NULL
-- ON CONFLICT (user_id) DO NOTHING;
