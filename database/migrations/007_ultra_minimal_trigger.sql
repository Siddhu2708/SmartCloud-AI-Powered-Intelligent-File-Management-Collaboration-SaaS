-- ============================================================
-- Migration 007: Ultra-Minimal Trigger
-- 
-- If previous migrations still fail, this is the absolute
-- simplest possible trigger that definitely won't error.
-- 
-- It does only one thing: creates a profile.
-- The subscription can be created by the backend instead.
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Step 1: Drop everything
drop trigger if exists on_auth_user_created on auth.users cascade;
drop function if exists public.handle_new_user() cascade;

-- Step 2: Create ultra-minimal function
-- Just creates profile, nothing else
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Step 3: Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- This minimal trigger only creates profiles.
-- The backend will create subscriptions when user first logs in.
-- 
-- This eliminates any race conditions or data type issues.
-- ============================================================

-- Step 4: Create subscriptions table defaults (if not already set)
alter table public.user_subscriptions
  alter column plan set default 'free',
  alter column storage_limit_bytes set default 16106127360,
  alter column ai_request_quota set default 0;

-- Step 5: After running this, manually fix any missing subscriptions:
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

