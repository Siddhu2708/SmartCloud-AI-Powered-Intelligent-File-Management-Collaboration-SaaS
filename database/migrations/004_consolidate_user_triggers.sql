-- ============================================================
-- Migration 004: Consolidate User Creation Triggers
-- 
-- ISSUE: Two separate triggers (on_auth_user_created and 
-- on_auth_user_subscription_created) were both firing on 
-- auth.users insert, causing race conditions and "Database error 
-- saving new user" errors during OAuth signup.
--
-- FIX: Consolidate both into a single trigger that creates
-- both profile AND subscription in one atomic operation.
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Drop the old separate triggers
drop trigger if exists on_auth_user_subscription_created on auth.users;

-- Update the handle_new_user function to do both profile + subscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Create profile
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  
  -- Create subscription (consolidated into single trigger to avoid race conditions)
  insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
  values (
    new.id,
    'free',
    15 * 1024 * 1024 * 1024,  -- 15 GB
    0                         -- unlimited for free tier (rate-limited on backend)
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- Ensure the trigger is properly set
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop the now-unused function
drop function if exists public.handle_new_user_subscription();

-- Verify tables are properly set up
-- These should all return true:
-- SELECT count(*) > 0 FROM information_schema.tables WHERE table_name = 'profiles';
-- SELECT count(*) > 0 FROM information_schema.tables WHERE table_name = 'user_subscriptions';
-- SELECT count(*) > 0 FROM pg_trigger WHERE tgname = 'on_auth_user_created';
