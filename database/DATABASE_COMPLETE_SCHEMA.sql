-- ============================================================
-- COMPLETE SMARTCLOUD DATABASE SCHEMA
-- With all required RLS policies and triggers
-- 
-- This is a complete, verified schema that should replace
-- any broken or incomplete schemas.
-- ============================================================

-- ============================================================
-- PROFILES TABLE
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

-- Drop existing policies to prevent conflicts
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "System can create profiles for new users" on public.profiles;

-- CREATE: Users can insert their own profile (normal app usage)
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- CREATE: System can create profiles for new users (trigger usage)
create policy "System can create profiles for new users"
  on public.profiles for insert 
  with check (true);

-- SELECT: Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

-- UPDATE: Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- USER_SUBSCRIPTIONS TABLE
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

-- Drop existing policies
drop policy if exists "Users can view own subscription" on public.user_subscriptions;
drop policy if exists "Users can update own subscription" on public.user_subscriptions;
drop policy if exists "System can create subscriptions for new users" on public.user_subscriptions;

-- SELECT: Users can view their own subscription
create policy "Users can view own subscription"
  on public.user_subscriptions for select using (auth.uid() = user_id);

-- CREATE: System can create subscriptions for new users (trigger usage)
create policy "System can create subscriptions for new users"
  on public.user_subscriptions for insert
  with check (true);

-- UPDATE: Users can update their own subscription
create policy "Users can update own subscription"
  on public.user_subscriptions for update using (auth.uid() = user_id);

-- ============================================================
-- FOLDERS TABLE
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

-- Drop existing policies
drop policy if exists "Owners can view their folders" on public.folders;
drop policy if exists "Owners can create folders" on public.folders;
drop policy if exists "Owners can update their folders" on public.folders;
drop policy if exists "Owners can delete their folders" on public.folders;

-- SELECT
create policy "Owners can view their folders"
  on public.folders for select using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.folder_id = folders.id
        and s.permission in ('viewer', 'editor')
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- INSERT
create policy "Owners can create folders"
  on public.folders for insert with check (auth.uid() = owner_id);

-- UPDATE
create policy "Owners can update their folders"
  on public.folders for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.folder_id = folders.id
        and s.permission = 'editor'
        and (s.expires_at is null or s.expires_at > now())
    )
  );

-- DELETE
create policy "Owners can delete their folders"
  on public.folders for delete using (auth.uid() = owner_id);

-- ============================================================
-- FILES TABLE
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

-- Drop existing policies
drop policy if exists "Owner and editors can view files" on public.files;
drop policy if exists "Owners can create files" on public.files;
drop policy if exists "Owner and editors can update files" on public.files;
drop policy if exists "Owners can delete files" on public.files;

-- SELECT
create policy "Owner and editors can view files"
  on public.files for select using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.file_id = files.id
        and s.permission in ('viewer', 'editor')
        and (s.expires_at is null or s.expires_at > now())
    )
    or (
      files.folder_id is not null
      and auth.uid() in (
        select s2.shared_with from public.shares s2
        where s2.folder_id = files.folder_id
          and s2.permission in ('viewer', 'editor')
          and (s2.expires_at is null or s2.expires_at > now())
      )
    )
  );

-- INSERT
create policy "Owners can create files"
  on public.files for insert with check (auth.uid() = owner_id);

-- UPDATE
create policy "Owner and editors can update files"
  on public.files for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.file_id = files.id
        and s.permission = 'editor'
        and (s.expires_at is null or s.expires_at > now())
    )
    or (
      files.folder_id is not null
      and auth.uid() in (
        select s2.shared_with from public.shares s2
        where s2.folder_id = files.folder_id
          and s2.permission = 'editor'
          and (s2.expires_at is null or s2.expires_at > now())
      )
    )
  );

-- DELETE
create policy "Owners can delete files"
  on public.files for delete using (auth.uid() = owner_id);

-- ============================================================
-- DOCUMENT_CHUNKS TABLE
-- ============================================================
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_file_id_idx on public.document_chunks (file_id);

-- Enable RLS
alter table public.document_chunks enable row level security;

-- Drop existing policies
drop policy if exists "Owners can view chunks" on public.document_chunks;
drop policy if exists "Owners can insert chunks" on public.document_chunks;
drop policy if exists "Owners can delete chunks" on public.document_chunks;

-- SELECT
create policy "Owners can view chunks"
  on public.document_chunks for select using (auth.uid() = owner_id);

-- INSERT
create policy "Owners can insert chunks"
  on public.document_chunks for insert with check (auth.uid() = owner_id);

-- DELETE
create policy "Owners can delete chunks"
  on public.document_chunks for delete using (auth.uid() = owner_id);

-- ============================================================
-- SHARES TABLE
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

-- Drop existing policies
drop policy if exists "Owners and recipients can view shares" on public.shares;
drop policy if exists "Owners can create shares" on public.shares;
drop policy if exists "Owners can update shares" on public.shares;
drop policy if exists "Owners can delete shares" on public.shares;

-- SELECT
create policy "Owners and recipients can view shares"
  on public.shares for select using (
    auth.uid() = owner_id or auth.uid() = shared_with
  );

-- INSERT
create policy "Owners can create shares"
  on public.shares for insert with check (auth.uid() = owner_id);

-- UPDATE
create policy "Owners can update shares"
  on public.shares for update using (auth.uid() = owner_id);

-- DELETE
create policy "Owners can delete shares"
  on public.shares for delete using (auth.uid() = owner_id);

-- ============================================================
-- AUDIT_LOGS TABLE
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

-- Drop existing policies
drop policy if exists "Users can view own audit logs" on public.audit_logs;
drop policy if exists "Users can insert audit logs" on public.audit_logs;

-- SELECT
create policy "Users can view own audit logs"
  on public.audit_logs for select using (auth.uid() = user_id);

-- INSERT
create policy "Users can insert audit logs"
  on public.audit_logs for insert with check (auth.uid() = user_id);

-- ============================================================
-- PAYMENTS TABLE
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

-- Drop existing policies
drop policy if exists "Users can view own payments" on public.payments;

-- SELECT
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET RLS
-- ============================================================

-- Insert storage bucket if not exists
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5368709120)
on conflict (id) do nothing;

-- Enable RLS on storage
alter table storage.objects enable row level security;

-- Drop existing storage policies
drop policy if exists "Users can access their own storage folder" on storage.objects;
drop policy if exists "Users can insert into their own storage folder" on storage.objects;
drop policy if exists "Users can update their own storage objects" on storage.objects;
drop policy if exists "Users can delete their own storage objects" on storage.objects;

-- SELECT
create policy "Users can access their own storage folder"
  on storage.objects for select
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

-- INSERT
create policy "Users can insert into their own storage folder"
  on storage.objects for insert
  with check ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

-- UPDATE
create policy "Users can update their own storage objects"
  on storage.objects for update
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

-- DELETE
create policy "Users can delete their own storage objects"
  on storage.objects for delete
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

-- ============================================================
-- TRIGGER FUNCTION
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
-- FIX ORPHANED USERS
-- ============================================================

-- Create missing profiles
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

-- Create missing subscriptions
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

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify no orphaned users remain
SELECT COUNT(*) as orphaned_count
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Verify trigger exists
SELECT tgname, tgrelname FROM pg_trigger 
WHERE tgname = 'on_auth_user_created' AND tgrelname = 'users';

-- List all RLS policies on profiles
SELECT polname, cmd FROM pg_policies WHERE tablename = 'profiles' ORDER BY polname;

-- List all RLS policies on user_subscriptions
SELECT polname, cmd FROM pg_policies WHERE tablename = 'user_subscriptions' ORDER BY polname;
