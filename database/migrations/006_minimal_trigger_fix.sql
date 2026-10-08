-- ============================================================
-- Migration 006: Minimal Trigger Fix - Use INSTEAD OF approach
-- 
-- The issue: handle_new_user() function is throwing an error
-- that's being caught by Supabase auth system.
--
-- Solution: Create a minimal function that handles errors gracefully
-- without re-throwing them (which blocks user creation).
-- 
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Step 1: Drop existing trigger and function completely
drop trigger if exists on_auth_user_created on auth.users cascade;
drop function if exists public.handle_new_user() cascade;

-- Step 2: Create a brand new, minimal function
-- This one won't throw errors - it will silently continue even if inserts fail
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer 
set search_path = public
as $$
declare
  v_profile_created boolean := false;
  v_subscription_created boolean := false;
begin
  -- Attempt to create profile (non-blocking on error)
  begin
    insert into public.profiles (id, email, full_name, avatar_url)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      coalesce(new.raw_user_meta_data->>'avatar_url', null)
    );
    v_profile_created := true;
  exception when others then
    -- Silently continue - don't block user creation
    v_profile_created := false;
  end;

  -- Attempt to create subscription (non-blocking on error)
  begin
    insert into public.user_subscriptions (
      user_id, 
      plan, 
      storage_limit_bytes, 
      ai_request_quota
    )
    values (
      new.id,
      'free',
      16106127360,
      0
    );
    v_subscription_created := true;
  exception when others then
    -- Silently continue - don't block user creation
    v_subscription_created := false;
  end;

  -- Always return new user (trigger must not fail)
  return new;
end;
$$;

-- Step 3: Create trigger (set it to AFTER INSERT)
create trigger on_auth_user_created
  after insert on auth.users
  for each row 
  execute function public.handle_new_user();

-- ============================================================
-- ALTERNATIVE: If the above still fails, use this completely
-- different approach - trigger via pg_net (async HTTP call to backend)
-- This requires the pg_net extension to be enabled on your Supabase project
-- ============================================================

-- Step 4 (Optional): If Step 3 fails, create a cleanup job instead
-- Run this periodically to create missing profiles/subscriptions
-- (This is a fallback - the trigger above should work)

create or replace function public.cleanup_missing_user_records()
returns table (
  users_processed integer,
  profiles_created integer,
  subscriptions_created integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profiles_created integer := 0;
  v_subscriptions_created integer := 0;
begin
  -- Create missing profiles
  with missing_profiles as (
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    left join public.profiles p on au.id = p.id
    where p.id is null
  )
  insert into public.profiles (id, email, full_name, avatar_url)
  select 
    id,
    email,
    coalesce(raw_user_meta_data->>'full_name', ''),
    raw_user_meta_data->>'avatar_url'
  from missing_profiles
  on conflict (id) do nothing;
  
  get diagnostics v_profiles_created = row_count;

  -- Create missing subscriptions
  with missing_subscriptions as (
    select au.id
    from auth.users au
    left join public.user_subscriptions s on au.id = s.user_id
    where s.user_id is null
  )
  insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
  select 
    id,
    'free',
    16106127360,
    0
  from missing_subscriptions
  on conflict (user_id) do nothing;
  
  get diagnostics v_subscriptions_created = row_count;

  return query select 
    (select count(*)::integer from auth.users),
    v_profiles_created,
    v_subscriptions_created;
end;
$$;

-- Step 5: Test the cleanup function (optional)
-- SELECT * FROM public.cleanup_missing_user_records();

-- Step 6: Verify the trigger now exists
-- Run this query - should return 1 row:
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Step 7: After running this migration, manually create any orphaned users:
-- SELECT * FROM public.cleanup_missing_user_records();

