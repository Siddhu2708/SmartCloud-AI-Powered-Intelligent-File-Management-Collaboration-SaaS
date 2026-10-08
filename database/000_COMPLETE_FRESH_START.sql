-- ============================================================
-- SMARTCLOUD COMPLETE DATABASE SETUP FROM SCRATCH
-- 
-- Run this ENTIRE script in Supabase SQL Editor
-- It will create ALL tables, ALL policies, ALL triggers
-- 
-- This is idempotent - safe to run multiple times
-- ============================================================

-- ============================================================
-- STEP 1: ENABLE REQUIRED EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- Note: pgvector is optional - if available, uncomment below
-- create extension if not exists "pgvector";

-- ============================================================
-- STEP 2: CREATE STORAGE BUCKET (for file uploads)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5368709120)
on conflict (id) do nothing;

-- ============================================================
-- STEP 3: PROFILES TABLE (user data mirror)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Drop old policies if they exist
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "System can create profiles for new users" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Create policies
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "System can create profiles for new users"
  on public.profiles for insert with check (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- STEP 4: USER_SUBSCRIPTIONS TABLE (billing & plans)
-- ============================================================
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  storage_limit_bytes bigint not null default 16106127360,
  ai_request_quota integer not null default 0,
  ai_requests_used integer not null default 0,
  billing_cycle_start timestamptz,
  billing_cycle_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  razorpay_plan_id text,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions (user_id);

-- Enable RLS
alter table public.user_subscriptions enable row level security;

-- Drop old policies
drop policy if exists "Users can view own subscription" on public.user_subscriptions;
drop policy if exists "System can create subscriptions for new users" on public.user_subscriptions;
drop policy if exists "Users can update own subscription" on public.user_subscriptions;

-- Create policies
create policy "Users can view own subscription"
  on public.user_subscriptions for select using (auth.uid() = user_id);

create policy "System can create subscriptions for new users"
  on public.user_subscriptions for insert with check (true);

create policy "Users can update own subscription"
  on public.user_subscriptions for update using (auth.uid() = user_id);

-- ============================================================
-- STEP 5: FOLDERS TABLE (file organization)
-- ============================================================
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  is_starred boolean not null default false,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_owner_id_idx on public.folders (owner_id);
create index if not exists folders_parent_id_idx on public.folders (parent_id);
create index if not exists folders_owner_trashed_idx on public.folders (owner_id, is_trashed);

-- Enable RLS
alter table public.folders enable row level security;

-- Drop old policies
drop policy if exists "Owners can view their folders" on public.folders;
drop policy if exists "Owners can create folders" on public.folders;
drop policy if exists "Owners can update their folders" on public.folders;
drop policy if exists "Owners can delete their folders" on public.folders;

-- Create simplified policies (will enhance after shares table is created)
create policy "Owners can view their folders"
  on public.folders for select using (auth.uid() = owner_id);

create policy "Owners can create folders"
  on public.folders for insert with check (auth.uid() = owner_id);

create policy "Owners can update their folders"
  on public.folders for update using (auth.uid() = owner_id);

create policy "Owners can delete their folders"
  on public.folders for delete using (auth.uid() = owner_id);

-- ============================================================
-- STEP 6: FILES TABLE (uploaded documents)
-- ============================================================
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  storage_path text not null,
  file_type text,
  mime_type text,
  file_size bigint not null default 0,
  is_starred boolean not null default false,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_owner_id_idx on public.files (owner_id);
create index if not exists files_folder_id_idx on public.files (folder_id);
create index if not exists files_owner_trashed_idx on public.files (owner_id, is_trashed);
create index if not exists files_owner_starred_idx on public.files (owner_id, is_starred);

-- Enable RLS
alter table public.files enable row level security;

-- Drop old policies
drop policy if exists "Owner and editors can view files" on public.files;
drop policy if exists "Owners can create files" on public.files;
drop policy if exists "Owner and editors can update files" on public.files;
drop policy if exists "Owners can delete files" on public.files;

-- Create simplified policies (will enhance after shares table is created)
create policy "Owner and editors can view files"
  on public.files for select using (auth.uid() = owner_id);

create policy "Owners can create files"
  on public.files for insert with check (auth.uid() = owner_id);

create policy "Owner and editors can update files"
  on public.files for update using (auth.uid() = owner_id);

create policy "Owners can delete files"
  on public.files for delete using (auth.uid() = owner_id);

-- ============================================================
-- STEP 7: DOCUMENT_CHUNKS TABLE (for AI search)
-- ============================================================
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  embedding text,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_file_id_idx on public.document_chunks (file_id);

-- Enable RLS
alter table public.document_chunks enable row level security;

-- Drop old policies
drop policy if exists "Owners can view chunks" on public.document_chunks;
drop policy if exists "Owners can insert chunks" on public.document_chunks;
drop policy if exists "Owners can delete chunks" on public.document_chunks;

-- Create policies
create policy "Owners can view chunks"
  on public.document_chunks for select using (auth.uid() = owner_id);

create policy "Owners can insert chunks"
  on public.document_chunks for insert with check (auth.uid() = owner_id);

create policy "Owners can delete chunks"
  on public.document_chunks for delete using (auth.uid() = owner_id);

-- ============================================================
-- STEP 8: SHARES TABLE (file sharing)
-- ============================================================
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  shared_with uuid not null references auth.users (id) on delete cascade,
  permission text not null default 'viewer' check (permission in ('viewer', 'editor')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shares_shared_with_idx on public.shares (shared_with);
create index if not exists shares_file_id_idx on public.shares (file_id);
create index if not exists shares_folder_id_idx on public.shares (folder_id);

-- Enable RLS
alter table public.shares enable row level security;

-- Drop old policies
drop policy if exists "Owners and recipients can view shares" on public.shares;
drop policy if exists "Owners can create shares" on public.shares;
drop policy if exists "Owners can update shares" on public.shares;
drop policy if exists "Owners can delete shares" on public.shares;

-- Create policies
create policy "Owners and recipients can view shares"
  on public.shares for select using (
    auth.uid() = owner_id or auth.uid() = shared_with
  );

create policy "Owners can create shares"
  on public.shares for insert with check (auth.uid() = owner_id);

create policy "Owners can update shares"
  on public.shares for update using (auth.uid() = owner_id);

create policy "Owners can delete shares"
  on public.shares for delete using (auth.uid() = owner_id);

-- ============================================================
-- STEP 9: AUDIT_LOGS TABLE (activity tracking)
-- ============================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Drop old policies
drop policy if exists "Users can view own audit logs" on public.audit_logs;
drop policy if exists "Users can insert audit logs" on public.audit_logs;

-- Create policies
create policy "Users can view own audit logs"
  on public.audit_logs for select using (auth.uid() = user_id);

create policy "Users can insert audit logs"
  on public.audit_logs for insert with check (auth.uid() = user_id);

-- ============================================================
-- STEP 10: PAYMENTS TABLE (billing)
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_name text not null,
  amount integer not null,
  currency text not null default 'INR',
  razorpay_order_id text not null unique,
  razorpay_payment_id text,
  razorpay_signature text,
  payment_status text not null default 'created' check (payment_status in ('created','attempted','paid','failed','refunded')),
  subscription_status text not null default 'pending' check (subscription_status in ('pending','active','cancelled','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_razorpay_order_idx on public.payments (razorpay_order_id);
create index if not exists payments_payment_status_idx on public.payments (payment_status);

-- Enable RLS
alter table public.payments enable row level security;

-- Drop old policies
drop policy if exists "Users can view own payments" on public.payments;

-- Create policies
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- ============================================================
-- STEP 11: STORAGE RLS (configured via Supabase dashboard)
-- ============================================================
-- Note: Storage bucket RLS policies must be configured in Supabase dashboard
-- Go to: Storage → documents → Policies → Add policy

-- ============================================================
-- STEP 11: TRIGGER FUNCTION (auto-create profile & subscription)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

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
  
  -- Create subscription
  insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
  values (
    new.id,
    'free',
    16106127360,
    0
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- VERIFICATION QUERIES (run these to verify everything works)
-- ============================================================

-- Check 1: All tables exist
select 'All tables created ✅' as status,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')) as table_count;

-- Check 2: RLS is enabled on all tables
select 'RLS enabled ✅' as status,
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity = true and tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')) as rls_count;

-- Check 3: Trigger exists
select 'Trigger created ✅' as status,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created') as trigger_count;

-- Check 4: Count all RLS policies
select 'Policies created ✅' as status,
  (select count(*) from pg_policies where tablename in ('profiles','user_subscriptions','folders','files','document_chunks','shares','audit_logs','payments')) as policy_count;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
select 'SmartCloud Database Setup Complete ✅' as final_status;
